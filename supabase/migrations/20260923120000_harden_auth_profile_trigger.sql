-- The incident reconciliation migration replaced the conflict-tolerant Auth
-- trigger with a simpler implementation. A public profile email is editable,
-- so it can legitimately conflict with a later Auth identity even though both
-- profile IDs satisfy the validated Auth FK. Never merge identities by email;
-- create the new ID-matched profile with a null conflicting optional value.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_email text := lower(nullif(trim(new.email), ''));
  profile_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(normalized_email, ''), '@', 1), '')
  );
  profile_email text := normalized_email;
  provider_avatar text := coalesce(
    new.raw_user_meta_data->>'picture',
    new.raw_user_meta_data->>'avatar_url'
  );
  failed_constraint text;
  attempt integer;
  profile_written boolean := false;
begin
  if profile_email is not null and exists (
    select 1
    from public.users as existing_profile
    where existing_profile.email = profile_email
      and existing_profile.id <> new.id
  ) then
    profile_email := null;
  end if;

  if provider_avatar is not null and exists (
    select 1
    from public.users as existing_profile
    where existing_profile.avatar_url = provider_avatar
      and existing_profile.id <> new.id
  ) then
    provider_avatar := null;
  end if;

  for attempt in 1..3 loop
    begin
      insert into public.users (id, name, email, avatar_url)
      values (new.id, profile_name, profile_email, provider_avatar)
      on conflict (id) do update
        set name = coalesce(public.users.name, excluded.name),
            email = coalesce(public.users.email, excluded.email),
            avatar_url = coalesce(public.users.avatar_url, excluded.avatar_url),
            updated_at = now();
      profile_written := true;
      exit;
    exception when unique_violation then
      get stacked diagnostics failed_constraint = constraint_name;
      if failed_constraint = 'users_email_key' then
        profile_email := null;
      elsif failed_constraint = 'users_avatar_url_unique_idx' then
        provider_avatar := null;
      else
        raise;
      end if;
    end;
  end loop;

  if not profile_written then
    raise exception 'Could not create an identity-safe profile for auth user %', new.id;
  end if;

  perform public.ensure_default_cash_wallet(new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to service_role;
