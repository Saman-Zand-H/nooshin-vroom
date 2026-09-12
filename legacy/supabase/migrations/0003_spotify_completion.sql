-- Keep a claimed authorization row until commit, so disconnect cancels even an
-- in-flight callback. Only the service-side OAuth handler may finish a link.
alter table public.spotify_states add column consumed_at timestamptz;

create function public.complete_spotify_link(state_key text, provider_id text, provider_name text, encrypted_tokens text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare member_id uuid;
begin
  delete from public.spotify_states
    where state_hash = state_key and consumed_at is not null and expires_at > now()
    returning user_id into member_id;
  if member_id is null or not exists(select 1 from public.room_members where user_id = member_id) then return false; end if;
  insert into public.spotify_accounts(user_id, spotify_id, display_name, token_box, updated_at)
    values(member_id, provider_id, provider_name, encrypted_tokens, now())
    on conflict(user_id) do update set spotify_id = excluded.spotify_id, display_name = excluded.display_name, token_box = excluded.token_box, updated_at = excluded.updated_at;
  return true;
end $$;
revoke all on function public.complete_spotify_link(text, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_spotify_link(text, text, text, text) to service_role;
