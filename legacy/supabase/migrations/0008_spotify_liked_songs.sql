-- Import Spotify liked songs into the shared music collection without
-- overwriting manually edited entries or duplicating manually linked tracks.
create function public.spotify_track_id(track_url text)
returns text language sql immutable set search_path = '' as $$
  select (regexp_match(track_url, '^https://open\.spotify\.com/track/([A-Za-z0-9]{22})/?(?:[?#][^[:space:]]*)?$'))[1]
$$;

create index room_entries_spotify_link
  on public.room_entries (public.spotify_track_id(link))
  where kind = 'music';

create function public.import_spotify_liked_songs(songs jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  song jsonb;
  track_id text;
  added integer := 0;
  skipped integer := 0;
begin
  if not public.is_room_member() then
    raise exception 'Invitation required' using errcode = '42501';
  end if;
  if songs is null or jsonb_typeof(songs) <> 'array'
    or jsonb_array_length(songs) not between 1 and 250
    or octet_length(songs::text) > 1000000
  then
    raise exception 'Invalid Spotify batch' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(742163006);
  for song in select value from jsonb_array_elements(songs) loop
    track_id := song->>'spotify_id';
    if jsonb_typeof(song) <> 'object'
      or not coalesce(track_id ~ '^[A-Za-z0-9]{22}$', false)
      or not public.section_text(song->'title', 240, true)
      or not public.section_text(song->'creator', 180)
      or (song->>'url') is distinct from 'https://open.spotify.com/track/' || track_id
    then
      raise exception 'Invalid Spotify song' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.room_entries
      where kind = 'music'
        and (
          source_id = 'spotify:' || track_id
          or public.spotify_track_id(link) = track_id
        )
    ) then
      skipped := skipped + 1;
      continue;
    end if;
    insert into public.room_entries(
      kind, title, creator, format, note, status, source_id, link, created_by
    ) values (
      'music', btrim(song->>'title'), btrim(song->>'creator'),
      'Spotify liked song', '', 'Saved', 'spotify:' || track_id,
      'https://open.spotify.com/track/' || track_id, auth.uid()
    );
    added := added + 1;
  end loop;
  return jsonb_build_object('added', added, 'skipped', skipped);
end $$;

revoke all on function public.spotify_track_id(text), public.import_spotify_liked_songs(jsonb)
  from public, anon;
grant execute on function public.spotify_track_id(text), public.import_spotify_liked_songs(jsonb)
  to authenticated;
