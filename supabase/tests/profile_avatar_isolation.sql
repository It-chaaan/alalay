-- Run with the Supabase database test runner after applying migrations.
-- This verifies that two newly-created profiles cannot share a non-null avatar URL.
begin;

do $$
declare
  first_user uuid := gen_random_uuid();
  second_user uuid := gen_random_uuid();
  duplicate_rejected boolean := false;
begin
  perform pg_temp.create_supabase_test_user(
    first_user,
    'avatar-test-one@example.test',
    '{"name":"Avatar Test One"}'
  );
  update public.users
  set avatar_url = 'https://example.test/avatar-one.png'
  where id = first_user;
  perform pg_temp.create_supabase_test_user(
    second_user,
    'avatar-test-two@example.test',
    '{"name":"Avatar Test Two"}'
  );

  begin
    update public.users
    set avatar_url = 'https://example.test/avatar-one.png'
    where id = second_user;
  exception when unique_violation then
    duplicate_rejected := true;
  end;

  if not duplicate_rejected then
    raise exception 'Duplicate non-null avatar_url was accepted';
  end if;

  update public.users
  set avatar_url = 'https://example.test/avatar-two.png'
  where id = second_user;

  if (select count(*) from public.users where id in (first_user, second_user) and avatar_url is not null) <> 2 then
    raise exception 'Back-to-back profiles did not retain distinct avatar URLs';
  end if;
end;
$$;

rollback;
