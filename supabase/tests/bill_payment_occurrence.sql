-- Run after applying all migrations. The transaction is always rolled back.
begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_wallet_id uuid := gen_random_uuid();
  v_recurring_bill_id uuid := gen_random_uuid();
  v_one_time_bill_id uuid := gen_random_uuid();
  v_result jsonb;
  v_duplicate_rejected boolean := false;
begin
  insert into public.users (id, name, email)
  values (v_user_id, 'Bill Payment Test', v_user_id || '@example.test');

  insert into public.wallets (
    id,
    user_id,
    name,
    institution_type,
    institution_key,
    account_type
  ) values (
    v_wallet_id,
    v_user_id,
    'Test Debit',
    'bank',
    'test-bank',
    'debit'
  );

  insert into public.wallet_adjustments (user_id, wallet_id, amount, date, note)
  values (v_user_id, v_wallet_id, 2000, date '2026-08-01', 'Test opening balance');

  insert into public.bills (
    id,
    user_id,
    title,
    amount,
    category,
    due_date,
    recurring,
    frequency,
    status
  ) values (
    v_recurring_bill_id,
    v_user_id,
    'Monthly utility',
    500,
    'Utilities',
    date '2026-08-14',
    true,
    'monthly',
    'overdue'
  );

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_result := public.mark_bill_paid(
    v_recurring_bill_id,
    v_wallet_id,
    date '2026-08-18',
    date '2026-08-14'
  );

  if v_result #>> '{expense,source_bill_occurrence_date}' <> '2026-08-14' then
    raise exception 'The paid occurrence date was not preserved';
  end if;
  if v_result #>> '{expense,date}' <> '2026-08-18' then
    raise exception 'The payment date was not preserved';
  end if;
  if v_result #>> '{bill,due_date}' <> '2026-09-14'
    or v_result #>> '{bill,status}' <> 'unpaid' then
    raise exception 'The recurring bill did not advance exactly one unpaid cycle';
  end if;
  if (select count(*) from public.expenses as e
      where e.source_bill_id = v_recurring_bill_id
        and e.source_bill_occurrence_date = date '2026-08-14'
        and e.deleted_at is null) <> 1 then
    raise exception 'The recurring occurrence did not create exactly one expense';
  end if;
  if (select w.balance from public.wallets as w where w.id = v_wallet_id) <> 1500 then
    raise exception 'The wallet was not deducted exactly once';
  end if;

  begin
    perform public.mark_bill_paid(
      v_recurring_bill_id,
      v_wallet_id,
      date '2026-08-18',
      date '2026-08-14'
    );
  exception when others then
    v_duplicate_rejected := sqlerrm = 'bill occurrence changed';
  end;
  if not v_duplicate_rejected then
    raise exception 'A duplicate occurrence payment was not rejected';
  end if;
  if (select w.balance from public.wallets as w where w.id = v_wallet_id) <> 1500 then
    raise exception 'The duplicate request changed the wallet balance';
  end if;

  insert into public.bills (
    id,
    user_id,
    title,
    amount,
    category,
    due_date,
    recurring,
    status
  ) values (
    v_one_time_bill_id,
    v_user_id,
    'One-time bill',
    250,
    'Utilities',
    date '2026-08-18',
    false,
    'unpaid'
  );

  v_result := public.mark_bill_paid(
    v_one_time_bill_id,
    v_wallet_id,
    date '2026-08-18',
    date '2026-08-18'
  );

  if v_result #>> '{bill,status}' <> 'paid'
    or v_result #>> '{bill,paid_occurrence_date}' <> '2026-08-18'
    or v_result #>> '{expense,date}' <> '2026-08-18' then
    raise exception 'The same-date one-time payment was not recorded correctly';
  end if;
  if (select w.balance from public.wallets as w where w.id = v_wallet_id) <> 1250 then
    raise exception 'The one-time payment did not deduct the wallet once';
  end if;
end;
$$;

rollback;
