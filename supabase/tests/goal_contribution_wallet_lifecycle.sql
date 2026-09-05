-- Run after all migrations. All data created by this test is rolled back.
begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  wallet_id uuid := gen_random_uuid();
  other_wallet_id uuid := gen_random_uuid();
  goal_id uuid := gen_random_uuid();
  other_goal_id uuid := gen_random_uuid();
  contribution_id uuid;
  retry_id uuid;
  release_id uuid;
  income_count integer;
  expense_count integer;
  rejected boolean := false;
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (owner_id, 'authenticated', 'authenticated', owner_id || '@example.test', '{"provider":"email"}', '{"name":"Goal owner"}', now(), now()),
    (other_id, 'authenticated', 'authenticated', other_id || '@example.test', '{"provider":"email"}', '{"name":"Other owner"}', now(), now());
  insert into public.wallets (id, user_id, name, institution_type, institution_key, account_type)
  values
    (wallet_id, owner_id, 'Owner wallet', 'bank', 'owner-bank', 'debit'),
    (other_wallet_id, other_id, 'Other wallet', 'bank', 'other-bank', 'debit');
  insert into public.wallet_adjustments (user_id, wallet_id, amount, date, note)
  values (owner_id, wallet_id, 100, date '2026-09-03', 'Opening balance');
  insert into public.savings_goals (id, user_id, title, target_amount, current_amount, deadline, monthly_target)
  values
    (goal_id, owner_id, 'Owner goal', 100, 0, date '2027-01-01', 0),
    (other_goal_id, other_id, 'Other goal', 100, 0, date '2027-01-01', 0);

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  select count(*) into income_count from public.income where user_id = owner_id;
  select count(*) into expense_count from public.expenses where user_id = owner_id;

  select id into contribution_id from public.add_goal_contribution(
    goal_id, wallet_id, 25, date '2026-09-03', 'First allocation', 'goal-lifecycle-test-1'
  );
  select id into retry_id from public.add_goal_contribution(
    goal_id, wallet_id, 25, date '2026-09-03', 'Retry', 'goal-lifecycle-test-1'
  );
  if contribution_id <> retry_id
    or (select count(*) from public.goal_contributions where user_id = owner_id and idempotency_key = 'goal-lifecycle-test-1') <> 1
    or (select current_amount from public.savings_goals where id = goal_id) <> 25
    or (select balance from public.wallets where id = wallet_id) <> 100
    or (select wallet_transaction_amount from public.goal_contributions where id = contribution_id) <> -25
    or (select count(*) from public.income where user_id = owner_id) <> income_count
    or (select count(*) from public.expenses where user_id = owner_id) <> expense_count then
    raise exception 'Goal contribution did not preserve the reserved-allocation and idempotency contract';
  end if;

  select id into release_id from public.release_goal_contribution(
    contribution_id, 10, date '2026-09-03', 'Partial release', 'goal-lifecycle-release-1'
  );
  perform public.release_goal_contribution(
    contribution_id, 10, date '2026-09-03', 'Retry', 'goal-lifecycle-release-1'
  );
  if (select count(*) from public.goal_contribution_releases where id = release_id) <> 1
    or (select current_amount from public.savings_goals where id = goal_id) <> 15
    or (select balance from public.wallets where id = wallet_id) <> 100
    or (select wrb.reserved_balance from public.wallet_reserved_balances as wrb where wrb.wallet_id = wallet_id) <> 15
    or (select count(*) from public.income where user_id = owner_id) <> income_count
    or (select count(*) from public.expenses where user_id = owner_id) <> expense_count then
    raise exception 'Goal release did not restore availability exactly once';
  end if;

  begin
    perform public.add_goal_contribution(other_goal_id, wallet_id, 1, date '2026-09-03', null, 'cross-goal');
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Cross-user goal was accepted'; end if;
  rejected := false;
  begin
    perform public.add_goal_contribution(goal_id, other_wallet_id, 1, date '2026-09-03', null, 'cross-wallet');
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Cross-user wallet was accepted'; end if;
  rejected := false;
  begin
    perform public.add_goal_contribution(goal_id, wallet_id, 1000, date '2026-09-03', null, 'over-allocation');
  exception when others then rejected := true;
  end;
  if not rejected
    or (select current_amount from public.savings_goals where id = goal_id) <> 15
    or (select count(*) from public.goal_contributions where user_id = owner_id) <> 1 then
    raise exception 'Failed contribution was not atomic';
  end if;

  if not has_function_privilege('authenticated', 'public.add_goal_contribution(uuid,uuid,numeric,date,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.add_goal_contribution(uuid,uuid,numeric,date,text,text)', 'EXECUTE')
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
