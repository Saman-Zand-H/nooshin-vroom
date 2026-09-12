-- Keep provider save/release metadata separate from personal song fields.
-- This makes the Songs page deterministic without changing what a member wrote.
alter table public.room_entries
  add column provider_added_at timestamptz,
  add column provider_album text,
  add column provider_release_year smallint;

alter table public.room_entries
  add constraint provider_music_metadata check (
    (provider_added_at is null and provider_album is null and provider_release_year is null)
    or (
      kind = 'music'
      and provider_added_at is not null
      and provider_album is not null
      and char_length(provider_album) <= 240
      and (provider_release_year is null or provider_release_year between 1000 and 9999)
    )
  );

create index room_entries_music_provider_added
  on public.room_entries (provider_added_at desc nulls last, updated_at desc, id)
  where kind = 'music';

create or replace function public.import_spotify_liked_songs(songs jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  song jsonb;
  track_id text;
  added_at timestamptz;
  album text;
  release_year smallint;
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
    album := nullif(btrim(song->>'album'), '');
    if song->>'release_year' is null or song->>'release_year' = '' then
      release_year := null;
    elsif song->>'release_year' ~ '^[0-9]{4}$' then
      release_year := (song->>'release_year')::smallint;
    else
      release_year := null;
    end if;
    begin
      added_at := (song->>'added_at')::timestamptz;
    exception when others then
      added_at := null;
    end;
    if jsonb_typeof(song) <> 'object'
      or not coalesce(track_id ~ '^[A-Za-z0-9]{22}$', false)
      or not public.section_text(song->'title', 240, true)
      or not public.section_text(song->'creator', 180)
      or added_at is null
      or album is null
      or char_length(album) > 240
      or (release_year is not null and (release_year < 1000 or release_year > 9999))
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
      -- Enrich older imported rows once while leaving all user-owned fields alone.
      update public.room_entries
      set provider_added_at = coalesce(provider_added_at, added_at),
          provider_album = coalesce(provider_album, album),
          provider_release_year = coalesce(provider_release_year, release_year)
      where kind = 'music'
        and (
          source_id = 'spotify:' || track_id
          or public.spotify_track_id(link) = track_id
        )
        and (
          provider_added_at is null
          or provider_album is null
          or (provider_release_year is null and release_year is not null)
        );
      skipped := skipped + 1;
      continue;
    end if;
    insert into public.room_entries(
      kind, title, creator, format, note, status, source_id, link, created_by,
      provider_added_at, provider_album, provider_release_year
    ) values (
      'music', btrim(song->>'title'), btrim(song->>'creator'),
      'Spotify liked song', '', 'Saved', 'spotify:' || track_id,
      'https://open.spotify.com/track/' || track_id, auth.uid(),
      added_at, album, release_year
    );
    added := added + 1;
  end loop;
  return jsonb_build_object('added', added, 'skipped', skipped);
end $$;

revoke all on function public.import_spotify_liked_songs(jsonb) from public, anon;
grant execute on function public.import_spotify_liked_songs(jsonb) to authenticated;
