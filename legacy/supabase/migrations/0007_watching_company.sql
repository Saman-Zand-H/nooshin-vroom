-- Old movie-night records were made for two. Missing audience remains valid
-- for older clients and is read as together; new plans choose solo or together.
alter table public.room_entries add constraint watching_company check (
  kind <> 'movie_night'
  or not (details ? 'audience')
  or coalesce(
    jsonb_typeof(details->'audience') = 'string'
    and details->>'audience' in ('solo', 'together'),
    false
  )
);
