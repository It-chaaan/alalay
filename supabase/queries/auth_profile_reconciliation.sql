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

-- Duplicate normalized profile emails.
select lower(nullif(trim(email), '')) as normalized_email, count(*) as profile_count,
       array_agg(id order by id) as profile_ids
from public.users
where nullif(trim(email), '') is not null
group by lower(nullif(trim(email), ''))
having count(*) > 1;

-- Every public FK that still points at the reviewed stale UUID.
do $$
declare fk record; row_count bigint;
begin
  for fk in
    select n.nspname as schema_name, c.relname as table_name, a.attname as column_name
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join unnest(con.conkey) with ordinality key(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.oid and a.attnum = key.attnum
    where con.contype = 'f' and con.confrelid = 'public.users'::regclass
      and array_length(con.conkey, 1) = 1 and n.nspname = 'public'
  loop
    execute format('select count(*) from %I.%I where %I = $1', fk.schema_name, fk.table_name, fk.column_name)
      into row_count using '3ce04d2c-648d-40fe-9206-f012ac56bc48'::uuid;
    raise notice 'stale UUID reference %.%(%) = %', fk.schema_name, fk.table_name, fk.column_name, row_count;
  end loop;
end;
$$;

-- After the reviewed orphan rows have been reconciled, validate the forward
-- identity constraint. This is intentionally not executed by this report.
-- alter table public.users validate constraint users_id_auth_users_fkey;
