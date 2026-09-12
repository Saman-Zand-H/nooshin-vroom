-- A durable common collection, private attachments, and server-only Spotify state.
-- Membership can only be provisioned by the administrator, never through signup.
alter table public.room_members add column slot smallint;
with numbered as (select user_id, row_number() over (order by created_at, user_id) as n from public.room_members)
update public.room_members m set slot = n.n from numbered n where m.user_id = n.user_id;
alter table public.room_members alter column slot set not null;
alter table public.room_members add constraint two_room_slots check (slot in (1, 2));
alter table public.room_members add constraint one_person_per_slot unique (slot);
revoke all on public.room_members from anon, authenticated;
grant select on public.room_members to authenticated;

create table public.room_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('book', 'music', 'wish', 'request', 'note', 'film', 'game')),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  creator text not null default '' check (char_length(creator) <= 180),
  note text not null default '' check (char_length(note) <= 4000),
  status text not null,
  progress smallint not null default 0 check (progress between 0 and 100),
  rating smallint not null default 0 check (rating between 0 and 5),
  format text not null default '' check (char_length(format) <= 80),
  link text not null default '' check (char_length(link) <= 2000 and (link = '' or link ~ '^https?://[^[:space:]]+$')),
  image_path text check (image_path is null or image_path ~ '^images/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'),
  image_url text check (image_url is null or (char_length(image_url) <= 2000 and image_url ~ '^https://(books\.google\.com|books\.googleusercontent\.com|covers\.openlibrary\.org)/')),
  recording_path text check (recording_path is null or (kind = 'request' and recording_path ~ '^recordings/[0-9a-f-]{36}/[0-9a-f-]{36}\.media$')),
  recording_type text check (recording_type is null or recording_type in ('audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'video/mp4', 'video/webm')),
  source_id text check (char_length(source_id) <= 200),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint kind_status check (
    (kind = 'book' and status in ('Want to read', 'Reading', 'Finished')) or
    (kind = 'music' and status in ('Saved', 'On repeat')) or
    (kind = 'wish' and status in ('Someday', 'Would love', 'Favourite')) or
    (kind = 'request' and status in ('Requested', 'Practicing', 'Recorded', 'Delivered')) or
    (kind = 'note' and status = 'Saved') or
    (kind = 'film' and status in ('Watchlist', 'Watching', 'Finished')) or
    (kind = 'game' and status in ('Want to play', 'Playing', 'Finished'))
  ),
  constraint completed_progress check (status <> 'Finished' or progress = 100),
  constraint performance_evidence check (kind <> 'request' or status not in ('Recorded', 'Delivered') or recording_path is not null or link <> '')
);
create unique index room_entries_source on public.room_entries(kind, source_id) where source_id is not null;
create index room_entries_recent on public.room_entries(updated_at desc);

create table public.room_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  title text not null,
  kind text not null,
  action text not null check (action in ('Added', 'Updated', 'Removed')),
  created_at timestamptz not null default now()
);
create index room_events_recent on public.room_events(created_at desc);

create function public.protect_room_entry() returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    new.version := 1;
    new.created_at := now();
  else
    if new.id <> old.id or new.kind <> old.kind or new.created_by <> old.created_by or new.created_at <> old.created_at then
      raise exception 'The original author, kind, and identity cannot be changed';
    end if;
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger protect_room_entry before insert or update on public.room_entries for each row execute function public.protect_room_entry();

create function public.record_room_event() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    insert into public.room_events(actor_id, title, kind, action) values (auth.uid(), old.title, old.kind, 'Removed');
    return old;
  end if;
  insert into public.room_events(actor_id, title, kind, action) values (auth.uid(), new.title, new.kind, case TG_OP when 'INSERT' then 'Added' else 'Updated' end);
  return new;
end $$;
revoke all on function public.record_room_event() from public, anon, authenticated;
create trigger record_room_event after insert or update or delete on public.room_entries for each row execute function public.record_room_event();

alter table public.room_entries enable row level security;
alter table public.room_events enable row level security;
revoke all on public.room_entries, public.room_events from anon, authenticated;
grant select, insert, update, delete on public.room_entries to authenticated;
grant select on public.room_events to authenticated;
revoke insert, update, delete on public.room_events from authenticated;
create policy entries_read on public.room_entries for select to authenticated using (public.is_room_member());
create policy entries_add on public.room_entries for insert to authenticated with check (public.is_room_member() and created_by = auth.uid());
create policy entries_edit on public.room_entries for update to authenticated using (public.is_room_member()) with check (public.is_room_member());
create policy entries_remove on public.room_entries for delete to authenticated using (public.is_room_member());
create policy events_read on public.room_events for select to authenticated using (public.is_room_member());

-- Purchase surprises never share a row with the publicly shared wish fields.
create table public.wish_surprises (
  entry_id uuid primary key references public.room_entries(id) on delete cascade,
  purchase_note text not null default '' check (char_length(purchase_note) <= 2000),
  budget text not null default '' check (char_length(budget) <= 100),
  purchased boolean not null default false
);
alter table public.wish_surprises enable row level security;
revoke all on public.wish_surprises from anon, authenticated;
grant select, insert, update, delete on public.wish_surprises to authenticated;
create policy owner_surprises on public.wish_surprises for all to authenticated
  using (exists (select 1 from public.room_members where user_id = auth.uid() and role = 'owner'))
  with check (exists (select 1 from public.room_members where user_id = auth.uid() and role = 'owner'));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
('room-images', 'room-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
('room-recordings', 'room-recordings', false, 52428800, array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'video/mp4', 'video/webm']);
create policy attachment_read on storage.objects for select to authenticated using (bucket_id in ('room-images', 'room-recordings') and public.is_room_member());
create policy attachment_add on storage.objects for insert to authenticated with check (
  bucket_id in ('room-images', 'room-recordings') and public.is_room_member() and (storage.foldername(name))[1] = auth.uid()::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png|media)$'
);
-- Immutable object names; replacements upload a new object before updating the row.
create policy attachment_remove on storage.objects for delete to authenticated using (bucket_id in ('room-images', 'room-recordings') and public.is_room_member());
drop policy "members can delete own room media" on storage.objects;
create policy "members can delete own room media" on storage.objects for delete to authenticated using (bucket_id = 'room-media' and public.is_room_member() and owner_id = auth.uid()::text);

-- Access and refresh tokens are encrypted by the Edge Function before storage.
create table public.spotify_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  spotify_id text not null,
  display_name text not null,
  token_box text not null,
  updated_at timestamptz not null default now()
);
create table public.spotify_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  verifier_box text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index spotify_states_user on public.spotify_states(user_id, expires_at);
alter table public.spotify_accounts enable row level security;
alter table public.spotify_states enable row level security;
revoke all on public.spotify_accounts, public.spotify_states from public, anon, authenticated;
grant all on public.spotify_accounts, public.spotify_states to service_role;
alter publication supabase_realtime add table public.room_entries, public.room_events;
