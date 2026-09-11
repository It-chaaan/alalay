-- DELETE /savings-goals/:id delegates to delete_savings_goal.  Test its RLS
-- boundary and ledger effects with RLS enabled under authenticated identities.
begin;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  wallet_a uuid := gen_random_uuid();
  goal_normal uuid := gen_random_uuid();
  goal_monthly uuid := gen_random_uuid();
  goal_funded uuid := gen_random_uuid();
  goal_completed uuid := gen_random_uuid();
  goal_archived uuid := gen_random_uuid();
  goal_b uuid := gen_random_uuid();
  contribution uuid := gen_random_uuid();
  wallet_balance_before numeric;
  rejected boolean;
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (user_a, 'authenticated', 'authenticated', user_a || '@example.test', '{"provider":"email"}', '{}', now(), now()),
    (user_b, 'authenticated', 'authenticated', user_b || '@example.test', '{"provider":"email"}', '{}', now(), now());

  insert into public.wallets (id, user_id, name, institution_type, institution_key, balance, account_type)
  values (wallet_a, user_a, 'Delete test wallet', 'bank', 'delete-test', 100, 'debit');
  insert into public.savings_goals (id, user_id, title, target_amount, current_amount, deadline, monthly_target, funding_method, monthly_contribution)
  values
    (goal_normal, user_a, 'Normal', 100, 0, date '2027-01-01', 0, 'manual', 0),
    -- Matches the reported failure: active monthly goal with no allocation.
    (goal_monthly, user_a, 'Monthly no allocation', 5000, 0, date '2027-01-01', 0, 'monthly', 1667),
    (goal_funded, user_a, 'Funded', 100, 40, date '2027-01-01', 0, 'manual', 0),
    (goal_completed, user_a, 'Completed', 50, 50, date '2027-01-01', 0, 'manual', 0),
    (goal_archived, user_a, 'Archived', 10, 0, date '2027-01-01', 0, 'manual', 0),
    (goal_b, user_b, 'Other user', 100, 0, date '2027-01-01', 0, 'manual', 0);
  update public.savings_goals set deleted_at = now() where id = goal_archived;
  insert into public.goal_contributions (id, user_id, goal_id, wallet_id, amount, contribution_date)
  values (contribution, user_a, goal_funded, wallet_a, 40, date '2026-09-11');

  grant select, insert, update, delete on public.savings_goals, public.goal_contributions,
    public.goal_contribution_releases, public.wallets to authenticated;
  grant usage, select on all sequences in schema public to authenticated;
  select balance into wallet_balance_before from public.wallets where id = wallet_a;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', user_a::text, true);

  if public.delete_savings_goal(goal_normal) <> goal_normal
    or public.delete_savings_goal(goal_monthly) <> goal_monthly
    or public.delete_savings_goal(goal_funded) <> goal_funded
    or public.delete_savings_goal(goal_completed) <> goal_completed then
    raise exception 'Goal deletion did not return the target ID';
  end if;

  rejected := false;
  begin perform public.delete_savings_goal(goal_funded); exception when sqlstate 'P0002' then rejected := true; end;
  if not rejected then raise exception 'Repeated goal deletion was not safely rejected'; end if;
  rejected := false;
  begin perform public.delete_savings_goal(goal_archived); exception when sqlstate 'P0002' then rejected := true; end;
  if not rejected then raise exception 'Archived goal deletion was not rejected'; end if;
  rejected := false;
  begin perform public.delete_savings_goal(goal_b); exception when sqlstate 'P0002' then rejected := true; end;
  if not rejected then raise exception 'Cross-user goal deletion was accepted'; end if;
  rejected := false;
  begin perform public.delete_savings_goal(gen_random_uuid()); exception when sqlstate 'P0002' then rejected := true; end;
  if not rejected then raise exception 'Missing goal deletion was not rejected'; end if;

  perform set_config('role', 'postgres', true);
  if not (select relrowsecurity from pg_class where oid = 'public.savings_goals'::regclass) then
    raise exception 'Savings-goal RLS was disabled';
  end if;
  if exists (select 1 from public.savings_goals where id in (goal_normal, goal_monthly, goal_funded, goal_completed) and deleted_at is null) then
    raise exception 'Deleted goal remained active';
  end if;
  if (select current_amount from public.savings_goals where id = goal_funded) <> 0
    or (select count(*) from public.goal_contribution_releases where contribution_id = contribution and amount = 40) <> 1
    or (select balance from public.wallets where id = wallet_a) <> wallet_balance_before then
    raise exception 'Funded-goal deletion corrupted its ledger or wallet balance';
  end if;
  if (select count(*) from public.goal_contribution_releases where contribution_id = contribution) <> 1
    or (select deleted_at is not null from public.savings_goals where id = goal_b) then
    raise exception 'Goal deletion violated isolation or idempotency';
  end if;
end;
$$;

rollback;
