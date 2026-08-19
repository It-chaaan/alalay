-- Validate ownership enforcement with two authenticated users. All fixture
-- writes and attempted attacks are rolled back by the test harness.
begin;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  wallet_a uuid := gen_random_uuid();
  wallet_b uuid := gen_random_uuid();
  credit_b uuid := gen_random_uuid();
  income_b uuid := gen_random_uuid();
  expense_b uuid := gen_random_uuid();
  bill_b uuid := gen_random_uuid();
  subscription_b uuid := gen_random_uuid();
  goal_b uuid := gen_random_uuid();
  loan_b uuid := gen_random_uuid();
  payment_b uuid := gen_random_uuid();
  transfer_b uuid := gen_random_uuid();
  rejected boolean;
  before_name text;
  before_balance numeric;
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (user_a, 'authenticated', 'authenticated', user_a || '@example.test', '{"provider":"email"}', '{"name":"RLS A"}', now(), now()),
    (user_b, 'authenticated', 'authenticated', user_b || '@example.test', '{"provider":"email"}', '{"name":"RLS B"}', now(), now());

  insert into public.wallets (id, user_id, name, institution_type, institution_key, account_type)
  values
    (wallet_a, user_a, 'A Wallet', 'bank', 'a-bank', 'debit'),
    (wallet_b, user_b, 'B Wallet', 'bank', 'b-bank', 'debit'),
    (credit_b, user_b, 'B Credit', 'bank', 'b-bank', 'credit');
  insert into public.wallet_adjustments (user_id, wallet_id, amount, date, note)
  values
    (user_a, wallet_a, 10000, date '2026-08-01', 'A opening'),
    (user_b, wallet_b, 10000, date '2026-08-01', 'B opening'),
    (user_b, credit_b, 3000, date '2026-08-01', 'B credit opening');

  insert into public.income (id, user_id, wallet_id, source, type, amount, date, is_recurring)
  values (income_b, user_b, wallet_b, 'B salary', 'salary', 1000, date '2026-08-10', false);
  insert into public.expenses (id, user_id, wallet_id, merchant, category, amount, date, payment_method)
  values (expense_b, user_b, wallet_b, 'B purchase', 'Food', 100, date '2026-08-10', 'bank_transfer');
  insert into public.bills (id, user_id, wallet_id, title, amount, category, due_date)
  values (bill_b, user_b, wallet_b, 'B bill', 200, 'Utilities', date '2026-08-20');
  insert into public.subscriptions (id, user_id, wallet_id, name, amount, renewal_date, billing_cycle)
  values (subscription_b, user_b, wallet_b, 'B Viu', 45, date '2026-08-25', 'monthly');
  insert into public.savings_goals (id, user_id, title, target_amount, current_amount, deadline, monthly_target)
  values (goal_b, user_b, 'B goal', 5000, 1000, date '2027-01-01', 0);
  insert into public.loans (id, user_id, wallet_id, direction, counterparty, original_principal, outstanding_principal, interest_type, start_date)
  values (loan_b, user_b, wallet_b, 'lent', 'B borrower', 1000, 1000, 'none', date '2026-08-01');
  insert into public.loan_payments (id, user_id, loan_id, wallet_id, principal_amount, interest_amount, paid_on)
  values (payment_b, user_b, loan_b, wallet_b, 100, 0, date '2026-08-15');
  insert into public.wallet_transfers (id, user_id, from_wallet_id, to_wallet_id, amount, transferred_at)
  values (transfer_b, user_b, wallet_b, credit_b, 100, date '2026-08-12');

  -- The local schema does not declare table grants in migrations. Grant the
  -- normal API table privileges for this isolated test transaction; RLS
  -- remains enabled and is the control being tested.
  grant select, insert, update, delete on public.wallets, public.income, public.expenses,
    public.bills, public.subscriptions, public.savings_goals, public.goal_contributions,
    public.loans, public.loan_payments, public.wallet_transfers, public.credit_repayments to authenticated;
  grant usage, select on all sequences in schema public to authenticated;

  select name, balance into before_name, before_balance from public.wallets where id = wallet_b;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', user_a::text, true);

  if (select count(*) from public.wallets where id in (wallet_b, credit_b)) <> 0
    or (select count(*) from public.income where id = income_b) <> 0
    or (select count(*) from public.expenses where id = expense_b) <> 0
    or (select count(*) from public.bills where id = bill_b) <> 0
    or (select count(*) from public.subscriptions where id = subscription_b) <> 0
    or (select count(*) from public.savings_goals where id = goal_b) <> 0
    or (select count(*) from public.loans where id = loan_b) <> 0
    or (select count(*) from public.loan_payments where id = payment_b) <> 0
    or (select count(*) from public.wallet_transfers where id = transfer_b) <> 0 then
    raise exception 'User A can read User B financial data';
  end if;

  rejected := false;
  begin
    perform public.recompute_wallet_balance(wallet_b);
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'User A could call the internal wallet recompute helper'; end if;

  rejected := false;
  begin
    perform public.ensure_default_cash_wallet(user_b);
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'User A could call the internal wallet setup helper'; end if;

  update public.wallets set name = 'ATTACKED' where id = wallet_b;
  if exists (select 1 from public.wallets where id = wallet_b and name <> before_name) then
    raise exception 'User A mutated User B wallet';
  end if;

  begin
    insert into public.wallets (user_id, name, institution_type, institution_key)
    values (user_b, 'Injected wallet', 'cash', 'cash');
  exception when others then null;
  end;
  if exists (select 1 from public.wallets where user_id = user_b and name = 'Injected wallet') then
    raise exception 'User A inserted User B wallet';
  end if;

  begin
    insert into public.income (user_id, wallet_id, source, type, amount, date, is_recurring)
    values (user_b, wallet_b, 'Injected income', 'salary', 1, date '2026-08-18', false);
  exception when others then null;
  end;
  if (select count(*) from public.income where user_id = user_b and source = 'Injected income') <> 0 then
    raise exception 'User A inserted User B income';
  end if;

  begin
    insert into public.expenses (user_id, wallet_id, merchant, category, amount, date, payment_method)
    values (user_b, wallet_b, 'Injected expense', 'Food', 1, date '2026-08-18', 'cash');
  exception when others then null;
  end;
  if (select count(*) from public.expenses where user_id = user_b and merchant = 'Injected expense') <> 0 then
    raise exception 'User A inserted User B expense';
  end if;

  begin
    insert into public.bills (user_id, wallet_id, title, amount, category, due_date)
    values (user_b, wallet_b, 'Injected bill', 1, 'Utilities', date '2026-08-18');
  exception when others then null;
  end;
  if (select count(*) from public.bills where user_id = user_b and title = 'Injected bill') <> 0 then
    raise exception 'User A inserted User B bill';
  end if;

  begin
    insert into public.subscriptions (user_id, wallet_id, name, amount, renewal_date, billing_cycle)
    values (user_b, wallet_b, 'Injected subscription', 1, date '2026-08-18', 'monthly');
  exception when others then null;
  end;
  if (select count(*) from public.subscriptions where user_id = user_b and name = 'Injected subscription') <> 0 then
    raise exception 'User A inserted User B subscription';
  end if;

  begin
    insert into public.savings_goals (user_id, title, target_amount, deadline)
    values (user_b, 'Injected goal', 1, date '2027-01-01');
  exception when others then null;
  end;
  if (select count(*) from public.savings_goals where user_id = user_b and title = 'Injected goal') <> 0 then
    raise exception 'User A inserted User B goal';
  end if;

  begin
    insert into public.loans (user_id, wallet_id, direction, counterparty, original_principal, outstanding_principal, interest_type, start_date)
    values (user_b, wallet_b, 'lent', 'Injected borrower', 1, 1, 'none', date '2026-08-18');
  exception when others then null;
  end;
  if (select count(*) from public.loans where user_id = user_b and counterparty = 'Injected borrower') <> 0 then
    raise exception 'User A inserted User B loan';
  end if;

  begin
    insert into public.loan_payments (user_id, loan_id, wallet_id, principal_amount, interest_amount, paid_on)
    values (user_b, loan_b, wallet_b, 1, 0, date '2026-08-18');
  exception when others then null;
  end;
  if (select count(*) from public.loan_payments where user_id = user_b and loan_id = loan_b and principal_amount = 1) <> 0 then
    raise exception 'User A inserted User B repayment';
  end if;

  begin
    insert into public.wallet_transfers (user_id, from_wallet_id, to_wallet_id, amount, transferred_at)
    values (user_b, wallet_b, credit_b, 1, date '2026-08-18');
  exception when others then null;
  end;
  if (select count(*) from public.wallet_transfers where user_id = user_b and amount = 1) <> 0 then
    raise exception 'User A inserted User B transfer';
  end if;

  rejected := false;
  begin
    perform public.create_wallet_transfer(wallet_b, wallet_a, 10, 0, 'internal', 'cross-user', date '2026-08-18', 'cross-user-transfer');
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Cross-user transfer RPC was accepted'; end if;

  rejected := false;
  begin
    perform public.repay_credit_account(
      credit_b, wallet_a, 10, 0, 0, date '2026-08-18',
      'cross-user-credit-repayment', null, null
    );
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Cross-user credit repayment RPC was accepted'; end if;

  rejected := false;
  begin
    perform public.mark_bill_paid(bill_b, wallet_b, date '2026-08-18', date '2026-08-20');
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Cross-user bill payment RPC was accepted'; end if;

  rejected := false;
  begin
    perform public.add_goal_contribution(goal_b, wallet_b, 10);
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Cross-user goal contribution RPC was accepted'; end if;

  rejected := false;
  begin
    perform public.record_loan_payment(loan_b, wallet_b, 10, 0, date '2026-08-18', 'cross-user', 'cross-user-loan-payment');
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Cross-user loan repayment RPC was accepted'; end if;

  rejected := false;
  begin
    perform public.create_loan(wallet_b, 'lent', 'Cross-user', 10, 'none', null, null, date '2026-08-18', null, null, 'cross-user-loan');
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Cross-user loan creation RPC was accepted'; end if;

  perform set_config('role', 'postgres', true);
  if (select name from public.wallets where id = wallet_b) <> before_name
    or (select balance from public.wallets where id = wallet_b) <> before_balance
    or (select count(*) from public.wallets where user_id = user_b and name = 'Injected wallet') <> 0
    or (select count(*) from public.income where user_id = user_b and source = 'Injected income') <> 0
    or (select count(*) from public.expenses where user_id = user_b and merchant = 'Injected expense') <> 0
    or (select count(*) from public.bills where user_id = user_b and title = 'Injected bill') <> 0
    or (select count(*) from public.subscriptions where user_id = user_b and name = 'Injected subscription') <> 0
    or (select count(*) from public.savings_goals where user_id = user_b and title = 'Injected goal') <> 0
    or (select count(*) from public.loans where user_id = user_b and counterparty = 'Injected borrower') <> 0
    or (select count(*) from public.loan_payments where user_id = user_b and loan_id = loan_b and principal_amount = 1) <> 0
    or (select count(*) from public.wallet_transfers where user_id = user_b and amount = 1) <> 0
    or (select count(*) from public.expenses where source_bill_id = bill_b) <> 0
    or (select count(*) from public.credit_repayments where user_id = user_b) <> 0
    or (select current_amount from public.savings_goals where id = goal_b) <> 1000
    or (select outstanding_principal from public.loans where id = loan_b) <> 1000
    or (select count(*) from public.wallet_transfers where id <> transfer_b and user_id = user_b) <> 0 then
    raise exception 'A rejected cross-user mutation changed User B financial state';
  end if;
end;
$$;

rollback;
