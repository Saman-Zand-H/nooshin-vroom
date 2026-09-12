-- IMDb exports are snapshots. This operation only adds missing film IDs and
-- never overwrites an existing title, watch status, rating, note, or attachment.
create function public.imdb_title_id(title_url text)
returns text language sql immutable set search_path = '' as $$
  select lower((regexp_match(title_url,
    '^https?://(?:www\.|m\.)?imdb\.com/title/(tt[0-9]{7,12})(?:/[^[:space:]]*|[?#][^[:space:]]*)?$', 'i'))[1]);
$$;
create index room_entries_imdb_link on public.room_entries (public.imdb_title_id(link)) where kind = 'film';

create function public.import_imdb_watchlist(films jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare film jsonb; title_id text; added integer := 0; skipped integer := 0;
begin
  if auth.uid() is null or not public.is_room_member() then
    raise exception 'Room invitation required' using errcode = '42501';
  end if;
  if films is null or jsonb_typeof(films) <> 'array' then
    raise exception 'Expected a list of IMDb titles' using errcode = '22023';
  end if;
  if jsonb_array_length(films) not between 1 and 250 or octet_length(films::text) > 2000000 then
    raise exception 'Import up to 250 titles per batch' using errcode = '22023';
  end if;
  -- Two invited people can import simultaneously without racing on manual
  -- entries whose IMDb identity exists only in their external link.
  perform pg_advisory_xact_lock(742163005);
  for film in select value from jsonb_array_elements(films) loop
    if jsonb_typeof(film) <> 'object'
      or not public.section_text(film->'imdb_id', 14, true)
      or not coalesce(film->>'imdb_id' ~ '^tt[0-9]{7,12}$', false)
      or not public.section_text(film->'title', 240, true)
      or not public.section_text(film->'creator', 180)
      or not public.section_text(film->'format', 80)
      or not public.section_text(film->'note', 4000)
    then raise exception 'Invalid IMDb title data' using errcode = '22023'; end if;
    title_id := film->>'imdb_id';
    if exists (select 1 from public.room_entries where kind = 'film'
      and (source_id = 'imdb:' || title_id or public.imdb_title_id(link) = title_id))
    then skipped := skipped + 1; continue; end if;
    insert into public.room_entries(kind, title, creator, format, note, status, source_id, link, created_by)
    values ('film', btrim(film->>'title'), btrim(film->>'creator'), btrim(film->>'format'), btrim(film->>'note'),
      'Watchlist', 'imdb:' || title_id, 'https://www.imdb.com/title/' || title_id || '/', auth.uid())
    on conflict do nothing;
    if found then added := added + 1; else skipped := skipped + 1; end if;
  end loop;
  return jsonb_build_object('added', added, 'skipped', skipped);
end $$;
revoke all on function public.import_imdb_watchlist(jsonb) from public, anon;
grant execute on function public.import_imdb_watchlist(jsonb) to authenticated;
