-- Current-schema regression coverage for the historical reconciliation helper.
-- The original incident involved a public profile without an auth.users row;
-- the validated identity FK now makes that state impossible to create.
begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  stale_id uuid := gen_random_uuid();
  v_wallet_id uuid := gen_random_uuid();
  rejected boolean := false;
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_id_auth_users_fkey'
      and convalidated
  ) then
    raise exception 'The public profile identity foreign key must remain validated';
  end if;

  if has_function_privilege(
    'anon',
    'public.reconcile_auth_profile(uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.reconcile_auth_profile(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'The incident-only reconciliation helper is client-executable';
  end if;

  -- Clean databases remain a safe no-op.
  perform public.reconcile_auth_profile(gen_random_uuid(), gen_random_uuid());

  -- Both profiles below are valid current-schema identities. The helper must
  -- fail closed instead of merging two real Auth users, even when their public
  -- profile data resembles the historical incident.
  perform pg_temp.create_supabase_test_user(
    owner_id,
    owner_id || '@example.test',
    '{"name":"Authoritative owner"}'
  );
  perform pg_temp.create_supabase_test_user(
    stale_id,
    stale_id || '@example.test',
    '{"name":"Second valid identity"}'
  );
  update public.users set email = null where id = owner_id;
  update public.users set email = owner_id || '@example.test' where id = stale_id;
  insert into public.wallets (id, user_id, name, institution_type, institution_key, account_type)
  values (v_wallet_id, stale_id, 'Current-schema wallet', 'bank', 'current-schema-bank', 'debit');

  begin
    perform public.reconcile_auth_profile(owner_id, stale_id);
  exception when others then
    rejected := position('stale UUID also exists in auth.users' in sqlerrm) > 0;
  end;

  if not rejected then
    raise exception 'Reconciliation did not reject a second valid Auth identity';
  end if;
  if not exists (select 1 from public.users where id = owner_id)
    or not exists (select 1 from public.users where id = stale_id)
    or not exists (
      select 1 from public.wallets as w where w.id = v_wallet_id and w.user_id = stale_id
    ) then
    raise exception 'Rejected reconciliation changed current-schema ownership';
  end if;
end;
$$;

rollback;
