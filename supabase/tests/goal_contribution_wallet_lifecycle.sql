-- Run after all migrations. All data created by this test is rolled back.
begin;

do $$
declare
  v_owner_id uuid := gen_random_uuid();
  v_other_id uuid := gen_random_uuid();
  v_wallet_id uuid := gen_random_uuid();
  v_other_wallet_id uuid := gen_random_uuid();
  v_goal_id uuid := gen_random_uuid();
  v_other_goal_id uuid := gen_random_uuid();
  v_contribution_id uuid;
  v_retry_id uuid;
  v_release_id uuid;
  income_count integer;
  expense_count integer;
  rejected boolean := false;
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_owner_id, 'authenticated', 'authenticated', v_owner_id || '@example.test', '{"provider":"email"}', '{"name":"Goal owner"}', now(), now()),
    (v_other_id, 'authenticated', 'authenticated', v_other_id || '@example.test', '{"provider":"email"}', '{"name":"Other owner"}', now(), now());
  insert into public.wallets (id, user_id, name, institution_type, institution_key, account_type)
  values
    (v_wallet_id, v_owner_id, 'Owner wallet', 'bank', 'owner-bank', 'debit'),
    (v_other_wallet_id, v_other_id, 'Other wallet', 'bank', 'other-bank', 'debit');
  insert into public.wallet_adjustments (user_id, wallet_id, amount, date, note)
  values (v_owner_id, v_wallet_id, 100, date '2026-09-03', 'Opening balance');
  insert into public.savings_goals (id, user_id, title, target_amount, current_amount, deadline, monthly_target)
  values
    (v_goal_id, v_owner_id, 'Owner goal', 100, 0, date '2027-01-01', 0),
    (v_other_goal_id, v_other_id, 'Other goal', 100, 0, date '2027-01-01', 0);

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
  select count(*) into income_count from public.income where user_id = v_owner_id;
  select count(*) into expense_count from public.expenses where user_id = v_owner_id;

  select id into v_contribution_id from public.add_goal_contribution(
    v_goal_id, v_wallet_id, 25, date '2026-09-03', 'First allocation', 'goal-lifecycle-test-1'
  );
  select id into v_retry_id from public.add_goal_contribution(
    v_goal_id, v_wallet_id, 25, date '2026-09-03', 'Retry', 'goal-lifecycle-test-1'
  );
  if v_contribution_id <> v_retry_id
    or (select count(*) from public.goal_contributions as gc where gc.user_id = v_owner_id and gc.idempotency_key = 'goal-lifecycle-test-1') <> 1
    or (select sg.current_amount from public.savings_goals as sg where sg.id = v_goal_id) <> 25
    or (select w.balance from public.wallets as w where w.id = v_wallet_id) <> 100
    or (select gc.wallet_transaction_amount from public.goal_contributions as gc where gc.id = v_contribution_id) <> -25
    or (select count(*) from public.income as i where i.user_id = v_owner_id) <> income_count
    or (select count(*) from public.expenses as e where e.user_id = v_owner_id) <> expense_count then
    raise exception 'Goal contribution did not preserve the reserved-allocation and idempotency contract';
  end if;

  select id into v_release_id from public.release_goal_contribution(
    v_contribution_id, 10, date '2026-09-03', 'Partial release', 'goal-lifecycle-release-1'
  );
  perform public.release_goal_contribution(
    v_contribution_id, 10, date '2026-09-03', 'Retry', 'goal-lifecycle-release-1'
  );
  if (select count(*) from public.goal_contribution_releases as gcr where gcr.id = v_release_id) <> 1
    or (select sg.current_amount from public.savings_goals as sg where sg.id = v_goal_id) <> 15
    or (select w.balance from public.wallets as w where w.id = v_wallet_id) <> 100
    or (select wrb.reserved_balance from public.wallet_reserved_balances as wrb where wrb.wallet_id = v_wallet_id) <> 15
    or (select count(*) from public.income as i where i.user_id = v_owner_id) <> income_count
    or (select count(*) from public.expenses as e where e.user_id = v_owner_id) <> expense_count then
    raise exception 'Goal release did not restore availability exactly once';
  end if;

  begin
    perform public.add_goal_contribution(v_other_goal_id, v_wallet_id, 1, date '2026-09-03', null, 'cross-goal');
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Cross-user goal was accepted'; end if;
  rejected := false;
  begin
    perform public.add_goal_contribution(v_goal_id, v_other_wallet_id, 1, date '2026-09-03', null, 'cross-wallet');
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Cross-user wallet was accepted'; end if;
  rejected := false;
  begin
    perform public.add_goal_contribution(v_goal_id, v_wallet_id, 1000, date '2026-09-03', null, 'over-allocation');
  exception when others then rejected := true;
  end;
  if not rejected
    or (select sg.current_amount from public.savings_goals as sg where sg.id = v_goal_id) <> 15
    or (select count(*) from public.goal_contributions as gc where gc.user_id = v_owner_id) <> 1 then
    raise exception 'Failed contribution was not atomic';
  end if;

  if not has_function_privilege('authenticated', 'public.add_goal_contribution(uuid,uuid,numeric,date,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.add_goal_contribution(uuid,uuid,numeric,date,text,text)', 'EXECUTE')
    or (select count(*)
        from pg_proc as signature
        join pg_namespace as signature_namespace on signature_namespace.oid = signature.pronamespace
        where signature_namespace.nspname = 'public'
          and signature.proname = 'add_goal_contribution') <> 1
    or not exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'add_goal_contribution'
        and pg_get_functiondef(p.oid) not like '%wallets as w%deleted_at%'
        and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=pg_catalog, public%'
    ) then
    raise exception 'Goal contribution RPC security or lifecycle definition is invalid';
  end if;
end;
$$;

rollback;
