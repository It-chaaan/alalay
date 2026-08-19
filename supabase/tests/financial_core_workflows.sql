-- Run after applying all migrations. Every financial mutation is rolled back.
begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_gcash_id uuid := gen_random_uuid();
  v_bdo_id uuid := gen_random_uuid();
  v_credit_id uuid := gen_random_uuid();
  v_transfer_source_id uuid := gen_random_uuid();
  v_transfer_destination_id uuid := gen_random_uuid();
  v_goal_id uuid := gen_random_uuid();
  v_subscription_id uuid := gen_random_uuid();
  v_credit_bill_id uuid := gen_random_uuid();
  v_lent_loan_id uuid;
  v_borrowed_loan_id uuid;
  v_income_before integer;
  v_expenses_before integer;
  v_bdo_before_repayment numeric;
  v_credit_before_repayment numeric;
begin
  insert into auth.users (
    id,
    aud,
    role,
    email,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    v_user_id,
    'authenticated',
    'authenticated',
    v_user_id || '@example.test',
    '{"provider":"email","providers":["email"]}',
    '{"name":"Financial Workflow Test"}',
    now(),
    now()
  );

  insert into public.wallets (id, user_id, name, institution_type, institution_key, account_type)
  values
    (v_gcash_id, v_user_id, 'GCash', 'e_wallet', 'gcash', null),
    (v_bdo_id, v_user_id, 'BDO Debit', 'bank', 'bdo', 'debit'),
    (v_credit_id, v_user_id, 'BDO Credit', 'bank', 'bdo', 'credit'),
    (v_transfer_source_id, v_user_id, 'Transfer GCash', 'e_wallet', 'gcash', null),
    (v_transfer_destination_id, v_user_id, 'Transfer BDO', 'bank', 'bdo', 'debit');

  insert into public.wallet_adjustments (user_id, wallet_id, amount, date, note)
  values
    (v_user_id, v_gcash_id, 5000, date '2026-08-01', 'Opening balance'),
    (v_user_id, v_bdo_id, 20000, date '2026-08-01', 'Opening balance'),
    (v_user_id, v_credit_id, 3000, date '2026-08-01', 'Opening outstanding'),
    (v_user_id, v_transfer_source_id, 5000, date '2026-08-01', 'Opening balance'),
    (v_user_id, v_transfer_destination_id, 20000, date '2026-08-01', 'Opening balance');

  insert into public.income (user_id, source, type, amount, date, is_recurring, frequency, wallet_id)
  values (v_user_id, 'Company', 'allowance', 1500, date '2026-08-18', false, null, v_gcash_id);

  if (select balance from public.wallets where id = v_gcash_id) <> 6500 then
    raise exception 'One-time income did not credit GCash exactly once';
  end if;
  if (select count(*) from public.income where user_id = v_user_id and source = 'Company') <> 1 then
    raise exception 'One-time income did not create exactly one row';
  end if;

  insert into public.expenses (user_id, wallet_id, merchant, category, amount, date, payment_method)
  values (v_user_id, v_bdo_id, 'Mercury Drug', 'Healthcare', 1000, date '2026-08-18', 'bank_transfer');

  if (select balance from public.wallets where id = v_bdo_id) <> 19000 then
    raise exception 'Asset expense did not debit BDO exactly once';
  end if;

  insert into public.expenses (user_id, wallet_id, merchant, category, amount, date, payment_method)
  values (v_user_id, v_credit_id, 'Credit purchase', 'Healthcare', 1000, date '2026-08-18', 'card');

  if (select balance from public.wallets where id = v_credit_id) <> 4000 then
    raise exception 'Credit expense did not increase the outstanding liability';
  end if;

  select count(*) into v_income_before from public.income where user_id = v_user_id;
  select count(*) into v_expenses_before from public.expenses where user_id = v_user_id;
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  perform public.create_wallet_transfer(
    v_transfer_source_id,
    v_transfer_destination_id,
    1000,
    15,
    'instapay',
    'Financial workflow test',
    date '2026-08-18',
    'financial-transfer-request-0001'
  );

  if (select balance from public.wallets where id = v_transfer_source_id) <> 3985 then
    raise exception 'Transfer source balance did not include principal and fee';
  end if;
  if (select balance from public.wallets where id = v_transfer_destination_id) <> 21000 then
    raise exception 'Transfer destination did not receive principal';
  end if;
  if (select count(*) from public.income where user_id = v_user_id) <> v_income_before then
    raise exception 'Transfer principal was incorrectly recorded as income';
  end if;
  if (select count(*) from public.expenses where user_id = v_user_id) <> v_expenses_before + 1 then
    raise exception 'Transfer fee did not create exactly one expense';
  end if;

  perform public.create_wallet_transfer(
    v_transfer_source_id,
    v_transfer_destination_id,
    1000,
    15,
    'instapay',
    'Financial workflow test retry',
    date '2026-08-18',
    'financial-transfer-request-0001'
  );
  if (select balance from public.wallets where id = v_transfer_source_id) <> 3985
    or (select balance from public.wallets where id = v_transfer_destination_id) <> 21000
    or (select count(*) from public.wallet_transfers where user_id = v_user_id) <> 1 then
    raise exception 'Transfer retry was not idempotent';
  end if;

  insert into public.savings_goals (id, user_id, title, target_amount, current_amount, deadline, monthly_target)
  values (v_goal_id, v_user_id, 'Emergency Fund', 10000, 2000, date '2027-01-01', 0);
  perform public.add_goal_contribution(v_goal_id, v_bdo_id, 3000);

  if (select current_amount from public.savings_goals where id = v_goal_id) <> 5000 then
    raise exception 'Goal contribution did not increase saved progress';
  end if;
  if (select balance from public.wallets where id = v_bdo_id) <> 19000 then
    raise exception 'Goal allocation must not debit the wallet or create spending';
  end if;

  select id into v_lent_loan_id from public.create_loan(
    v_bdo_id, 'lent', 'John', 5000, 'none', null, null,
    date '2026-08-18', null, null, 'financial-lend-request-0001'
  );
  if (select balance from public.wallets where id = v_bdo_id) <> 14000 then
    raise exception 'Lending principal did not reduce the asset wallet';
  end if;
  if (select count(*) from public.expenses where user_id = v_user_id) <> v_expenses_before + 1 then
    raise exception 'Lending principal was incorrectly recorded as expense';
  end if;

  perform public.record_loan_payment(
    v_lent_loan_id, v_bdo_id, 2000, 200,
    date '2026-08-20', 'Partial repayment', 'financial-lend-payment-0001'
  );
  if (select outstanding_principal from public.loans where id = v_lent_loan_id) <> 3000 then
    raise exception 'Lent loan repayment did not reduce receivable principal';
  end if;
  if (select balance from public.wallets where id = v_bdo_id) <> 16200 then
    raise exception 'Lent repayment did not credit principal and interest';
  end if;
  if (select count(*) from public.income where user_id = v_user_id) <> v_income_before + 1 then
    raise exception 'Only loan interest should create an income row';
  end if;

  perform public.record_loan_payment(
    v_lent_loan_id, v_bdo_id, 2000, 200,
    date '2026-08-20', 'Partial repayment retry', 'financial-lend-payment-0001'
  );
  if (select outstanding_principal from public.loans where id = v_lent_loan_id) <> 3000
    or (select balance from public.wallets where id = v_bdo_id) <> 16200
    or (select count(*) from public.loan_payments where loan_id = v_lent_loan_id) <> 1 then
    raise exception 'Loan repayment retry was not idempotent';
  end if;

  select id into v_borrowed_loan_id from public.create_loan(
    v_gcash_id, 'borrowed', 'Maria', 4000, 'none', null, null,
    date '2026-08-18', null, null, 'financial-borrow-request-001'
  );
  if (select balance from public.wallets where id = v_gcash_id) <> 10500 then
    raise exception 'Borrowed principal did not credit GCash';
  end if;
  if (select count(*) from public.income where user_id = v_user_id) <> v_income_before + 1 then
    raise exception 'Borrowed principal was incorrectly recorded as income';
  end if;
  if (select outstanding_principal from public.loans where id = v_borrowed_loan_id) <> 4000 then
    raise exception 'Borrowed loan did not retain liability principal';
  end if;

  insert into public.subscriptions (
    id, user_id, name, amount, category, renewal_date, billing_cycle,
    auto_renew, wallet_id
  ) values (
    v_subscription_id, v_user_id, 'Viu', 45, 'Streaming', date '2026-08-25',
    'monthly', true, v_bdo_id
  );
  if (select count(*) from public.expenses where subscription_id = v_subscription_id) <> 0
    or (select renewal_date from public.subscriptions where id = v_subscription_id) <> date '2026-08-25'
    or (select category from public.subscriptions where id = v_subscription_id) <> 'Streaming' then
    raise exception 'Subscription definition charged early or lost required fields';
  end if;

  insert into public.expenses (
    user_id, wallet_id, merchant, category, amount, date, payment_method,
    subscription_id, billing_cycle, occurrence_date, generated_by,
    recurrence_key, billing_status
  ) values (
    v_user_id, v_bdo_id, 'Viu Subscription', 'Subscriptions', 45,
    date '2026-08-25', 'other', v_subscription_id, 'monthly', date '2026-08-25',
    'subscription', v_subscription_id || ':2026-08-25:monthly', 'generated'
  );
  insert into public.expenses (
    user_id, wallet_id, merchant, category, amount, date, payment_method,
    subscription_id, billing_cycle, occurrence_date, generated_by,
    recurrence_key, billing_status
  ) values (
    v_user_id, v_bdo_id, 'Viu Subscription Retry', 'Subscriptions', 45,
    date '2026-08-25', 'other', v_subscription_id, 'monthly', date '2026-08-25',
    'subscription', v_subscription_id || ':2026-08-25:monthly', 'generated'
  ) on conflict (user_id, subscription_id, occurrence_date, billing_cycle) do nothing;
  if (select count(*) from public.expenses where subscription_id = v_subscription_id) <> 1 then
    raise exception 'Subscription occurrence was not idempotent';
  end if;

  v_bdo_before_repayment := (select balance from public.wallets where id = v_bdo_id);
  v_credit_before_repayment := (select balance from public.wallets where id = v_credit_id);
  perform public.repay_credit_account(
    v_credit_id, v_bdo_id, 2000, 100, 25, date '2026-08-18',
    'credit-repayment-request-0001', null, null
  );
  if (select balance from public.wallets where id = v_credit_id) <> v_credit_before_repayment - 2000
    or (select balance from public.wallets where id = v_bdo_id) <> v_bdo_before_repayment - 2125
    or (select count(*) from public.credit_repayments where credit_wallet_id = v_credit_id) <> 1
    or (select count(*) from public.expenses where credit_repayment_id is not null) <> 2 then
    raise exception 'Credit repayment did not separate principal, interest, and fee correctly';
  end if;

  perform public.repay_credit_account(
    v_credit_id, v_bdo_id, 2000, 100, 25, date '2026-08-18',
    'credit-repayment-request-0001', null, null
  );
  if (select count(*) from public.credit_repayments where credit_wallet_id = v_credit_id) <> 1
    or (select balance from public.wallets where id = v_credit_id) <> v_credit_before_repayment - 2000
    or (select balance from public.wallets where id = v_bdo_id) <> v_bdo_before_repayment - 2125 then
    raise exception 'Credit repayment retry was not idempotent';
  end if;

  begin
    perform public.repay_credit_account(
      v_credit_id, v_bdo_id, 10000, 0, 0, date '2026-08-18',
      'credit-repayment-overpayment-0001', null, null
    );
    raise exception 'Credit overpayment was accepted';
  exception when others then
    if position('exceeds outstanding' in sqlerrm) = 0 then raise; end if;
  end;

  insert into public.bills (
    id, user_id, title, amount, category, due_date, credit_wallet_id
  ) values (
    v_credit_bill_id, v_user_id, 'Credit statement', 500, 'Credit Card',
    date '2026-08-19', v_credit_id
  );
  insert into public.expenses (user_id, wallet_id, merchant, category, amount, date, payment_method)
  values (v_user_id, v_credit_id, 'Statement purchase', 'Shopping', 500, date '2026-08-19', 'card');
  if (select balance from public.wallets where id = v_credit_id) <> v_credit_before_repayment - 1500 then
    raise exception 'Credit statement purchase did not increase liability';
  end if;
  perform public.mark_bill_paid(v_credit_bill_id, v_bdo_id, date '2026-08-19', date '2026-08-19');
  if (select status from public.bills where id = v_credit_bill_id) <> 'paid'
    or (select count(*) from public.expenses where source_bill_id = v_credit_bill_id) <> 0
    or (select count(*) from public.credit_repayments where source_bill_id = v_credit_bill_id) <> 1
    or (select balance from public.wallets where id = v_credit_id) <> v_credit_before_repayment - 2000 then
    raise exception 'Credit statement payment did not use canonical repayment accounting';
  end if;
end;
$$;

rollback;
