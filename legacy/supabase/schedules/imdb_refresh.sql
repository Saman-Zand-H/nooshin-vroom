-- Run after deploying imdb-watchlist and creating both Vault secrets. Values
-- are read at execution time; no credentials appear in cron.job.command.
--   control_room_imdb_function_url: https://<project>.supabase.co/functions/v1/imdb-watchlist/scheduled
--   control_room_imdb_cron_secret: same random 32+ character IMDB_CRON_SECRET as the Edge Function
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name = 'control_room_imdb_function_url')
    or not exists(select 1 from vault.decrypted_secrets where name = 'control_room_imdb_cron_secret' and length(decrypted_secret) >= 32)
  then raise exception 'Create the IMDb URL and scheduler secret in Supabase Vault first'; end if;
end $$;

select cron.schedule('control-room-imdb-refresh', '*/15 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'control_room_imdb_function_url'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-room-scheduler', (select decrypted_secret from vault.decrypted_secrets where name = 'control_room_imdb_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 110000
  );
$$);
-- The function checks next_refresh_at: six hours after success, one hour after
-- failure. To pause background refreshes: select cron.unschedule('control-room-imdb-refresh');
