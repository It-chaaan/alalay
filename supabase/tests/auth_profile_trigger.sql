-- Auth/profile trigger regression coverage.
-- Run with the local Supabase database test runner after migrations.
begin;

do $$
declare
  confirmed_user uuid := gen_random_uuid();
  unconfirmed_user uuid := gen_random_uuid();
  orphan_user uuid := gen_random_uuid();
  orphan_email text := 'auth-profile-orphan@example.test';
  repeated_user uuid := gen_random_uuid();
  null_email_user uuid := gen_random_uuid();
  profile_count integer;
  profile_email text;
begin
  -- New confirmed and unconfirmed auth identities both receive one profile.
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (confirmed_user, 'authenticated', 'authenticated', 'auth-profile-confirmed@example.test', now(), '{"provider":"email"}', '{"full_name":"Confirmed"}', now(), now()),
    (unconfirmed_user, 'authenticated', 'authenticated', 'auth-profile-unconfirmed@example.test', null, '{"provider":"email"}', '{"full_name":"Unconfirmed"}', now(), now());

  if (select count(*) from public.users where id in (confirmed_user, unconfirmed_user)) <> 2 then
    raise exception 'New confirmed/unconfirmed auth identities did not get profiles';
  end if;

  -- Providers may create an Auth row before an email is available. The
  -- trigger must still use NEW.id and must not invent an email identity.
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (null_email_user, 'authenticated', 'authenticated', null, null, '{"provider":"google"}', '{"name":"No Email"}', now(), now());
  if (select count(*) from public.users where id = null_email_user and email is null) <> 1 then
    raise exception 'Null-email Auth identity did not receive an id-matched profile';
  end if;

  -- A current-schema profile whose editable public email differs from its Auth
  -- email must not be merged into a newly-created Auth identity. This retains
  -- the historical regression coverage without bypassing the validated FK or
  -- disabling triggers.
  perform pg_temp.create_supabase_test_user(
    orphan_user,
    'auth-profile-existing@example.test',
    '{"name":"Existing owner"}'
  );
  update public.users set name = 'Existing owner', email = orphan_email where id = orphan_user;

  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (gen_random_uuid(), 'authenticated', 'authenticated', orphan_email, now(), '{"provider":"email"}', '{"name":"New owner"}', now(), now());

  select count(*) into profile_count
  from public.users
  where email = orphan_email;
  if profile_count <> 1 then
    raise exception 'Conflicting email was merged or duplicated in public.users';
  end if;

  -- Repeated execution with the same Auth UUID is idempotent. A temporary
  -- trigger table supplies the same NEW fields without inserting a duplicate
  -- row into auth.users.
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (repeated_user, 'authenticated', 'authenticated', 'auth-profile-repeated@example.test', now(), '{"provider":"email"}', '{"name":"Repeated"}', now(), now());
  delete from public.users where id = repeated_user;

  create temporary table auth_profile_trigger_fixture (
    id uuid,
    email text,
    raw_user_meta_data jsonb
  ) on commit drop;
  create trigger auth_profile_trigger_fixture_insert
    after insert on auth_profile_trigger_fixture
    for each row execute function public.handle_new_user();

  insert into auth_profile_trigger_fixture
  values (repeated_user, 'auth-profile-repeated@example.test', '{"name":"Repeated"}');
  insert into auth_profile_trigger_fixture
  values (repeated_user, 'auth-profile-repeated@example.test', '{"name":"Repeated again"}');

  select count(*), max(email) into profile_count, profile_email
  from public.users where id = repeated_user;
  if profile_count <> 1 or profile_email <> 'auth-profile-repeated@example.test' then
    raise exception 'Repeated profile trigger execution was not idempotent';
  end if;
end;
$$;

rollback;
