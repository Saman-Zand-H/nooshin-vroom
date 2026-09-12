-- The room is private by default. Apply in a Supabase project before enabling persistence.
create extension if not exists pgcrypto;

create table if not exists public.room_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);

create or replace function public.is_room_member()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.room_members where user_id = auth.uid()) $$;
revoke all on function public.is_room_member() from public;
grant execute on function public.is_room_member() to authenticated;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 240),
  author text not null check (char_length(author) between 1 and 180),
  status text not null default 'Want to read' check (status in ('Reading', 'Want to read', 'Finished')),
  progress smallint not null default 0 check (progress between 0 and 100),
  note text check (char_length(note) <= 2000),
  cover_path text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 240),
  artist text not null check (char_length(artist) between 1 and 180),
  note text check (char_length(note) <= 2000),
  artwork_path text,
  spotify_url text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 240),
  details text check (char_length(details) <= 1000),
  image_path text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.violin_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 240),
  artist text check (char_length(artist) <= 180),
  message text check (char_length(message) <= 2000),
  status text not null default 'Requested' check (status in ('Requested', 'Practicing', 'Recorded', 'Delivered')),
  recording_path text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  kind text not null check (char_length(kind) between 1 and 80),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;
do $$
declare table_name text;
begin
  foreach table_name in array array['books', 'songs', 'vault_items', 'violin_requests'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.room_members enable row level security;
alter table public.books enable row level security;
alter table public.songs enable row level security;
alter table public.vault_items enable row level security;
alter table public.violin_requests enable row level security;
alter table public.activity enable row level security;

create policy "room members can read membership" on public.room_members for select to authenticated using (public.is_room_member());
create policy "room members can read books" on public.books for select to authenticated using (public.is_room_member());
create policy "members can insert books" on public.books for insert to authenticated with check (public.is_room_member() and created_by = auth.uid());
create policy "members can update books" on public.books for update to authenticated using (public.is_room_member()) with check (public.is_room_member());
create policy "members can delete books" on public.books for delete to authenticated using (public.is_room_member());
create policy "room members can read songs" on public.songs for select to authenticated using (public.is_room_member());
create policy "members can insert songs" on public.songs for insert to authenticated with check (public.is_room_member() and created_by = auth.uid());
create policy "members can update songs" on public.songs for update to authenticated using (public.is_room_member()) with check (public.is_room_member());
create policy "members can delete songs" on public.songs for delete to authenticated using (public.is_room_member());
create policy "room members can read vault" on public.vault_items for select to authenticated using (public.is_room_member());
create policy "members can insert vault" on public.vault_items for insert to authenticated with check (public.is_room_member() and created_by = auth.uid());
create policy "members can update vault" on public.vault_items for update to authenticated using (public.is_room_member()) with check (public.is_room_member());
create policy "members can delete vault" on public.vault_items for delete to authenticated using (public.is_room_member());
create policy "room members can read requests" on public.violin_requests for select to authenticated using (public.is_room_member());
create policy "members can insert requests" on public.violin_requests for insert to authenticated with check (public.is_room_member() and created_by = auth.uid());
create policy "members can update requests" on public.violin_requests for update to authenticated using (public.is_room_member()) with check (public.is_room_member());
create policy "members can delete requests" on public.violin_requests for delete to authenticated using (public.is_room_member());
create policy "room members can read activity" on public.activity for select to authenticated using (public.is_room_member());
create policy "members write own activity" on public.activity for insert to authenticated with check (public.is_room_member() and actor_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-media', 'room-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'video/mp4'])
on conflict (id) do update set public = false, file_size_limit = 5242880;
create policy "members can read room media" on storage.objects for select to authenticated using (bucket_id = 'room-media' and public.is_room_member());
create policy "members can upload room media" on storage.objects for insert to authenticated with check (bucket_id = 'room-media' and public.is_room_member() and (storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'mp3', 'm4a', 'wav', 'mp4')));
create policy "members can update own room media" on storage.objects for update to authenticated using (bucket_id = 'room-media' and owner_id = auth.uid()::text) with check (bucket_id = 'room-media' and public.is_room_member());
create policy "members can delete own room media" on storage.objects for delete to authenticated using (bucket_id = 'room-media' and owner_id = auth.uid()::text);

alter publication supabase_realtime add table public.books, public.songs, public.vault_items, public.violin_requests, public.activity;
