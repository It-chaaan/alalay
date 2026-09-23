-- Session-local helpers shared by SQL regression tests. The test runner loads
-- this file into each psql connection before the rollback-only test body.
create or replace function pg_temp.create_supabase_test_user(
  p_user_id uuid,
  p_email text default null,
  p_user_metadata jsonb default '{}'::jsonb,
  p_email_confirmed boolean default true,
  p_app_metadata jsonb default '{"provider":"email","providers":["email"]}'::jsonb
)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_user_id,
    'authenticated',
    'authenticated',
    p_email,
    '',
    case when p_email_confirmed then now() else null end,
    p_app_metadata,
    p_user_metadata,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'Auth trigger did not create profile for test user %', p_user_id;
  end if;
end;
$$;
