-- READ-ONLY reconciliation report. Review these results before changing data.
-- Do not delete or merge rows by email: auth.users.id is authoritative.

-- Public profiles with no corresponding Supabase Auth identity.
select
  profile.id,
  profile.email,
  profile.created_at
from public.users as profile
left join auth.users as auth_user on auth_user.id = profile.id
where auth_user.id is null
order by profile.created_at, profile.id;

-- Auth identities missing their public profile row.
select
  auth_user.id,
  auth_user.email,
  auth_user.email_confirmed_at,
  auth_user.created_at
from auth.users as auth_user
left join public.users as profile on profile.id = auth_user.id
where profile.id is null
order by auth_user.created_at, auth_user.id;

-- Rows whose stored profile email differs from Auth. The backend should use
-- auth.users.email for display until a reviewed reconciliation is completed.
select
  auth_user.id,
  auth_user.email as auth_email,
  profile.email as profile_email
from auth.users as auth_user
join public.users as profile on profile.id = auth_user.id
where coalesce(lower(trim(auth_user.email)), '') <> coalesce(lower(trim(profile.email)), '');

-- After the reviewed orphan rows have been reconciled, validate the forward
-- identity constraint. This is intentionally not executed by this report.
-- alter table public.users validate constraint users_id_auth_users_fkey;
