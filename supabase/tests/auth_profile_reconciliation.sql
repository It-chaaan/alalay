-- Synthetic regression tests for the incident reconciliation helper.
-- Every fixture is rolled back and contains no production identifiers.
begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  stale_id uuid := gen_random_uuid();
  wallet_id uuid := gen_random_uuid();
  family_id uuid := gen_random_uuid();
  expense_id uuid := gen_random_uuid();
  conflict_owner_id uuid := gen_random_uuid();
  conflict_stale_id uuid := gen_random_uuid();
  conflict_wallet_id uuid := gen_random_uuid();
  rejected boolean;
begin
  -- Clean databases safely no-op.
  perform public.reconcile_auth_profile(gen_random_uuid(), gen_random_uuid());

  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (owner_id, 'authenticated', 'authenticated', owner_id || '@example.test', '{"provider":"email"}', '{}', now(), now());
  update public.users set email = null where id = owner_id;
  insert into public.users (id, name, email) values (stale_id, 'Synthetic legacy profile', owner_id || '@example.test');
  insert into public.wallets (id, user_id, name, institution_type, institution_key, color)
  values (wallet_id, stale_id, 'Synthetic wallet', 'cash', 'cash', '#123456');
  update public.wallets set is_default_cash = true where id = wallet_id;
  insert into public.families (id, name, owner_id, member_ids)
  values (family_id, 'Synthetic family', stale_id, array[stale_id, owner_id]);
  insert into public.expenses (
    id, user_id, amount, category, merchant, date, payment_method, wallet_id, split_with
  ) values (
    expense_id, stale_id, 10, 'Other', 'Synthetic expense', current_date,
    'cash', wallet_id, array[stale_id, owner_id]
  );

  perform public.reconcile_auth_profile(owner_id, stale_id);

  if exists (select 1 from public.users where id = stale_id)
    or not exists (select 1 from public.users where id = owner_id)
    or not exists (select 1 from public.wallets where id = wallet_id and user_id = owner_id and not is_default_cash)
    or not exists (select 1 from public.families f where f.id = family_id and f.owner_id = owner_id and f.member_ids = array[owner_id])
    or not exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = owner_id and e.split_with = array[owner_id]) then
    raise exception 'Synthetic ownership reconciliation did not preserve the ownership graph';
  end if;

  -- Repeating the repair after success is a no-op.
  perform public.reconcile_auth_profile(owner_id, stale_id);

  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (conflict_owner_id, 'authenticated', 'authenticated', conflict_owner_id || '@example.test', '{"provider":"email"}', '{}', now(), now());
  update public.users set email = null where id = conflict_owner_id;
  insert into public.users (id, name, email) values (conflict_stale_id, 'Synthetic conflict profile', conflict_owner_id || '@example.test');
  insert into public.wallets (id, user_id, name, institution_type, institution_key, color)
  values (conflict_wallet_id, conflict_stale_id, 'Synthetic conflict wallet', 'bank', 'synthetic-bank', '#123456');
  insert into public.dashboard_preferences (user_id)
  values (conflict_owner_id), (conflict_stale_id);

  rejected := false;
  begin
    perform public.reconcile_auth_profile(conflict_owner_id, conflict_stale_id);
  exception when others then
    rejected := true;
  end;
  if not rejected then raise exception 'Unique ownership conflict was not rejected'; end if;
  if not exists (select 1 from public.users where id = conflict_stale_id)
    or not exists (select 1 from public.wallets where id = conflict_wallet_id and user_id = conflict_stale_id) then
    raise exception 'Rejected reconciliation left partial ownership changes';
  end if;
end;
$$;

rollback;
