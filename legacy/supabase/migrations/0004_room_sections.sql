-- New personal sections use the same membership, optimistic version, event,
-- and private-attachment policies as the existing room entries.
alter table public.room_entries add column details jsonb;
alter table public.room_entries drop constraint room_entries_kind_check;
alter table public.room_entries add constraint room_entries_kind_check check
  (kind in ('book', 'music', 'wish', 'request', 'note', 'film', 'game', 'rabbit_hole', 'movie_night', 'adventure', 'lyric'));
alter table public.room_entries drop constraint kind_status;
alter table public.room_entries add constraint kind_status check (
  (kind = 'book' and status in ('Want to read', 'Reading', 'Finished')) or
  (kind = 'music' and status in ('Saved', 'On repeat')) or
  (kind = 'wish' and status in ('Someday', 'Would love', 'Favourite')) or
  (kind = 'request' and status in ('Requested', 'Practicing', 'Recorded', 'Delivered')) or
  (kind = 'note' and status = 'Saved') or
  (kind = 'film' and status in ('Watchlist', 'Watching', 'Finished')) or
  (kind = 'game' and status in ('Want to play', 'Playing', 'Finished')) or
  (kind = 'rabbit_hole' and status = 'Saved') or
  (kind = 'movie_night' and status in ('Idea', 'Planned', 'Watched')) or
  (kind = 'adventure' and status in ('Someday', 'A memory')) or
  (kind = 'lyric' and status = 'On the wall')
);

create function public.section_text(value jsonb, maximum integer, required boolean default false)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'string' and char_length(value #>> '{}') <= maximum
    and (not required or value #>> '{}' ~ '[^[:space:]]'), false)
$$;
create function public.section_date(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare text_value text;
begin
  if not public.section_text(value, 10) then return false; end if;
  text_value := value #>> '{}';
  if text_value = '' then return true; end if;
  if text_value !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  return to_char(text_value::date, 'YYYY-MM-DD') = text_value;
exception when others then return false;
end $$;

create function public.valid_section_details(entry_kind text, data jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; items jsonb; chosen text;
begin
  if entry_kind not in ('rabbit_hole', 'movie_night', 'adventure', 'lyric') then
    return data is null or data in ('null'::jsonb, '{}'::jsonb);
  end if;
  if data is null or jsonb_typeof(data) <> 'object' or (data->>'type') is distinct from entry_kind or octet_length(data::text) > 20000 then return false; end if;
  if entry_kind = 'rabbit_hole' then
    items := data->'steps';
    if jsonb_typeof(items) is distinct from 'array' then return false; end if;
    if jsonb_array_length(items) not between 2 and 12 then return false; end if;
    for item in select * from jsonb_array_elements(items) loop
      if jsonb_typeof(item) <> 'object' or not public.section_text(item->'title', 240, true)
        or not public.section_text(item->'reason', 700)
        or not coalesce(item->>'kind' in ('music', 'book', 'film', 'game', 'character', 'quote', 'place', 'idea'), false)
        or not coalesce(item->>'id' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$', false)
        or not coalesce(item->'entryId' = 'null'::jsonb or item->>'entryId' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$', false)
      then return false; end if;
    end loop;
    return (select count(*) = count(distinct value->>'id') from jsonb_array_elements(items));
  end if;
  if entry_kind = 'movie_night' then
    if not coalesce(data->>'place' in ('My place', 'Her place', 'Cinema', 'Somewhere else'), false)
      or not public.section_date(data->'date') or not public.section_text(data->'time', 5)
      or (data->>'time' <> '' and data->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
      or not public.section_text(data->'snacks', 500)
    then return false; end if;
    items := data->'films';
    if jsonb_typeof(items) is distinct from 'array' then return false; end if;
    if jsonb_array_length(items) > 8 then return false; end if;
    for item in select * from jsonb_array_elements(items) loop
      if jsonb_typeof(item) <> 'object' or not public.section_text(item->'title', 240, true)
        or not coalesce(item->>'id' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$', false)
        or not coalesce(item->'entryId' = 'null'::jsonb or item->>'entryId' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$', false)
      then return false; end if;
    end loop;
    if (select count(*) <> count(distinct value->>'id') from jsonb_array_elements(items)) then return false; end if;
    if data->'chosenId' = 'null'::jsonb then return true; end if;
    if not public.section_text(data->'chosenId', 36, true) then return false; end if;
    return exists(select 1 from jsonb_array_elements(items) where value->>'id' = data->>'chosenId');
  end if;
  if entry_kind = 'adventure' then return public.section_text(data->'place', 180) and public.section_date(data->'date'); end if;
  if not coalesce(data->>'paper' in ('parchment', 'rose', 'lavender', 'midnight'), false)
    or not coalesce(data->>'lettering' in ('handwritten', 'serif', 'typewriter'), false)
    or not coalesce(data->>'size' in ('small', 'medium', 'large'), false)
    or jsonb_typeof(data->'position') is distinct from 'number'
  then return false; end if;
  return abs((data->>'position')::numeric) <= 1e15;
exception when others then return false;
end $$;
alter table public.room_entries add constraint validated_section_details check (public.valid_section_details(kind, details));
alter table public.room_entries add constraint lyric_words_required check (kind <> 'lyric' or note ~ '[^[:space:]]');
alter table public.room_entries add constraint screening_has_choice check (kind <> 'movie_night' or status <> 'Watched' or details->>'chosenId' is not null);
