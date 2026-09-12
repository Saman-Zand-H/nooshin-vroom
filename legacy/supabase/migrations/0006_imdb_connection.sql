-- Public IMDb links are not authentication credentials. Only the Edge Function
-- owns refresh leases and snapshots; browser roles cannot forge a successful sync.
create table public.imdb_watchlist_connections (
  user_id uuid primary key references public.room_members(user_id) on delete cascade,
  source_url text not null check (source_url ~ '^https://www\.imdb\.com/user/(ur[0-9]{1,20}|p\.[A-Za-z0-9_-]{1,128})/watchlist/$'),
  profile_id text not null,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  next_refresh_at timestamptz not null default now(),
  title_count integer not null default 0 check (title_count between 0 and 12000),
  last_added integer not null default 0 check (last_added between 0 and 12000),
  last_error text check (last_error in ('private_or_missing', 'rate_limited', 'unavailable', 'response_changed', 'too_large', 'timed_out', 'interrupted')),
  lease_id uuid,
  lease_expires_at timestamptz,
  snapshot_ids text[] not null default '{}'::text[] check (cardinality(snapshot_ids) <= 12000),
  constraint matching_imdb_profile check (source_url = 'https://www.imdb.com/user/' || profile_id || '/watchlist/')
);
alter table public.imdb_watchlist_connections enable row level security;
revoke all on public.imdb_watchlist_connections from public, anon, authenticated;
grant select, insert, update, delete on public.imdb_watchlist_connections to service_role;

create function public.begin_imdb_refresh(actor uuid, requested_url text default null, manual boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare connection public.imdb_watchlist_connections; token uuid; profile text;
begin
  if not exists(select 1 from public.room_members where user_id = actor) then raise exception 'Invitation required' using errcode = '42501'; end if;
  if requested_url is not null then
    profile := (regexp_match(requested_url, '^https://www\.imdb\.com/user/(ur[0-9]{1,20}|p\.[A-Za-z0-9_-]{1,128})/watchlist/$'))[1];
    if profile is null then raise exception 'Invalid IMDb Watchlist URL' using errcode = '22023'; end if;
    insert into public.imdb_watchlist_connections(user_id, source_url, profile_id) values(actor, requested_url, profile) on conflict(user_id) do nothing;
  end if;
  select * into connection from public.imdb_watchlist_connections where user_id = actor for update;
  if not found then return jsonb_build_object('state', 'disconnected'); end if;
  if requested_url is not null and requested_url <> connection.source_url then return jsonb_build_object('state', 'different_link'); end if;
  if connection.lease_id is not null and connection.lease_expires_at > clock_timestamp() then return jsonb_build_object('state', 'busy'); end if;
  if connection.last_attempt_at > clock_timestamp() - interval '1 minute' then return jsonb_build_object('state', 'cooldown'); end if;
  if not manual and connection.next_refresh_at > clock_timestamp() then return jsonb_build_object('state', 'not_due'); end if;
  token := gen_random_uuid();
  update public.imdb_watchlist_connections set lease_id = token, lease_expires_at = clock_timestamp() + interval '2 minutes',
    last_attempt_at = clock_timestamp(), next_refresh_at = clock_timestamp() + interval '15 minutes', last_error = null where user_id = actor;
  return jsonb_build_object('state', 'claimed', 'lease_id', token, 'source_url', connection.source_url);
end $$;

create function public.finish_imdb_refresh(actor uuid, token uuid, films jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare connection public.imdb_watchlist_connections; film jsonb; new_ids text[] := '{}'; added integer := 0;
begin
  select * into connection from public.imdb_watchlist_connections where user_id = actor and lease_id = token and lease_expires_at > clock_timestamp() for update;
  if not found then return jsonb_build_object('applied', false); end if;
  if not exists(select 1 from public.room_members where user_id = actor) then return jsonb_build_object('applied', false); end if;
  if films is null or jsonb_typeof(films) <> 'array' then raise exception 'Incomplete IMDb snapshot' using errcode = '22023'; end if;
  if jsonb_array_length(films) > 12000 or octet_length(films::text) > 16000000 then raise exception 'IMDb snapshot too large' using errcode = '22023'; end if;
  -- Same import lock as CSV. Snapshot + additions commit together, once.
  perform pg_advisory_xact_lock(742163005);
  for film in select value from jsonb_array_elements(films) loop
    if jsonb_typeof(film) <> 'object' or not coalesce(film->>'imdb_id' ~ '^tt[0-9]{7,12}$', false)
      or not public.section_text(film->'title', 240, true) or not public.section_text(film->'creator', 180)
      or not public.section_text(film->'format', 80) then raise exception 'Invalid IMDb snapshot item' using errcode = '22023'; end if;
  end loop;
  if (select count(*) <> count(distinct value->>'imdb_id') from jsonb_array_elements(films)) then raise exception 'Duplicate page data' using errcode = '22023'; end if;
  select coalesce(array_agg(value->>'imdb_id'), '{}'::text[]) into new_ids from jsonb_array_elements(films);
  -- A member's deletion is not resurrected on every refresh. Set operations
  -- also keep a full 12,000-title snapshot from doing quadratic array copies.
  insert into public.room_entries(kind, title, creator, format, note, status, source_id, link, created_by)
  select 'film', btrim(item.title), btrim(item.creator), btrim(item.format), '', 'Watchlist', 'imdb:' || item.imdb_id,
    'https://www.imdb.com/title/' || item.imdb_id || '/', actor
  from jsonb_to_recordset(films) as item(imdb_id text, title text, creator text, format text)
  left join unnest(connection.snapshot_ids) as previous(imdb_id) on previous.imdb_id = item.imdb_id
  where previous.imdb_id is null
    and not exists(select 1 from public.room_entries where kind = 'film' and (source_id = 'imdb:' || item.imdb_id or public.imdb_title_id(link) = item.imdb_id))
  on conflict do nothing;
  get diagnostics added = row_count;
  update public.imdb_watchlist_connections set snapshot_ids = new_ids, title_count = cardinality(new_ids), last_added = added,
    last_success_at = clock_timestamp(), next_refresh_at = clock_timestamp() + interval '6 hours', last_error = null, lease_id = null, lease_expires_at = null where user_id = actor and lease_id = token;
  return jsonb_build_object('applied', true, 'added', added, 'total', cardinality(new_ids));
end $$;

create function public.fail_imdb_refresh(actor uuid, token uuid, failure text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if failure not in ('private_or_missing', 'rate_limited', 'unavailable', 'response_changed', 'too_large', 'timed_out', 'interrupted') then failure := 'unavailable'; end if;
  update public.imdb_watchlist_connections set last_error = failure, lease_id = null, lease_expires_at = null,
    next_refresh_at = clock_timestamp() + interval '1 hour'
    where user_id = actor and lease_id = token and lease_expires_at > clock_timestamp();
  return found;
end $$;

create function public.imdb_background_ready()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare ready boolean;
begin
  if to_regclass('cron.job') is null then return false; end if;
  execute 'select exists(select 1 from cron.job where jobname = $1 and active)' into ready using 'control-room-imdb-refresh';
  return ready;
end $$;
revoke all on function public.begin_imdb_refresh(uuid, text, boolean), public.finish_imdb_refresh(uuid, uuid, jsonb), public.fail_imdb_refresh(uuid, uuid, text), public.imdb_background_ready() from public, anon, authenticated;
grant execute on function public.begin_imdb_refresh(uuid, text, boolean), public.finish_imdb_refresh(uuid, uuid, jsonb), public.fail_imdb_refresh(uuid, uuid, text), public.imdb_background_ready() to service_role;
