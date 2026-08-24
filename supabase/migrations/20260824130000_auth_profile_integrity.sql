-- Keep Supabase Auth as the source of identity truth.
-- public.users is application profile data keyed by the same UUID, not a
-- second account directory.  The email uniqueness constraint on public.users
-- remains in place; auth.users remains authoritative for authentication and
-- email ownership.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_id_auth_users_fkey'
  ) then
    -- NOT VALID lets an operator deploy the identity invariant while legacy
    -- orphan rows are reviewed separately.  New and changed rows are checked
    -- immediately; validate after reconciliation has been reviewed.
    alter table public.users
      add constraint users_id_auth_users_fkey
      foreign key (id) references auth.users(id) on delete cascade
      not valid;
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_avatar text;
  profile_email text;
  failed_constraint text;
  attempt integer;
  inserted boolean := false;
begin
  provider_avatar := coalesce(new.raw_user_meta_data->>'picture', new.raw_user_meta_data->>'avatar_url');

  -- Provider images are shared/default data surprisingly often. Preserve the
  -- existing avatar-isolation invariant without allowing a race to abort auth.
  if provider_avatar is not null and exists (
    select 1 from public.users where avatar_url = provider_avatar
  ) then
    provider_avatar := null;
  end if;

  -- A profile row with this auth UUID is already the same identity. Do not
  -- overwrite profile metadata or attempt to merge by email.
  profile_email := new.email;

  -- If a legacy/orphan profile owns this email, retain that row for review and
  -- create the new auth identity without copying the conflicting email into
  -- public.users. Auth email remains available through auth.users and the
  -- backend already prefers the authenticated email when returning profiles.
  if profile_email is not null and exists (
    select 1
    from public.users existing_profile
    where existing_profile.email = profile_email
      and existing_profile.id <> new.id
  ) then
    profile_email := null;
  end if;

  -- ON CONFLICT (id) makes repeated trigger execution safe. The bounded retry
  -- handles a concurrent legacy row race on either retained uniqueness rule;
  -- it never changes or merges the other user's profile.
  for attempt in 1..3 loop
    begin
      insert into public.users (id, name, email, avatar_url)
      values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
        profile_email,
        provider_avatar
      )
      on conflict (id) do nothing;
      inserted := true;
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

  if not inserted then
    raise exception 'Could not create an identity-safe profile for auth user %', new.id;
  end if;

  -- Keep the existing wallet-on-signup behavior, including for a repeated
  -- profile-trigger invocation.
  perform public.ensure_default_cash_wallet(new.id);
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_id_auth_users_fkey'
  ) then
    comment on constraint users_id_auth_users_fkey on public.users is
      'Application profile identity is the corresponding Supabase Auth user UUID; validate after legacy orphan reconciliation.';
  end if;
end;
$$;
