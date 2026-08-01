-- Run with the Supabase database test runner after applying migrations.
-- This verifies that two newly-created profiles cannot share a non-null avatar URL.
begin;

do $$
declare
  first_user uuid := gen_random_uuid();
  second_user uuid := gen_random_uuid();
  duplicate_rejected boolean := false;
begin
  insert into public.users (id, name, email, avatar_url)
  values (first_user, 'Avatar Test One', 'avatar-test-one@example.test', 'https://example.test/avatar-one.png');

  begin
    insert into public.users (id, name, email, avatar_url)
    values (second_user, 'Avatar Test Two', 'avatar-test-two@example.test', 'https://example.test/avatar-one.png');
  exception when unique_violation then
    duplicate_rejected := true;
  end;

  if not duplicate_rejected then
    raise exception 'Duplicate non-null avatar_url was accepted';
  end if;

  insert into public.users (id, name, email, avatar_url)
  values (second_user, 'Avatar Test Two', 'avatar-test-two@example.test', 'https://example.test/avatar-two.png');

  if (select count(*) from public.users where id in (first_user, second_user) and avatar_url is not null) <> 2 then
    raise exception 'Back-to-back profiles did not retain distinct avatar URLs';
  end if;
end;
$$;

rollback;
