-- These RPCs predate the posted-income occurrence contract. Keep the
-- validation trigger strict and make each manual posting supply its source and
-- receipt timestamp explicitly.
create or replace function public.record_loan_payment(
  loan_id_value uuid,
  wallet_id_value uuid,
  principal_value numeric,
  interest_value numeric,
  paid_on_value date,
  note_value text,
  request_key text
)
returns public.loan_payments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  owner_id uuid := auth.uid();
  loan_row public.loans;
  wallet_row public.wallets;
  result public.loan_payments;
  allocated numeric;
  interest_income public.income;
  interest_expense public.expenses;
  effective_paid_on date := coalesce(paid_on_value, current_date);
begin
  if owner_id is null then
    raise exception 'Authentication is required';
  end if;
  if principal_value < 0 or interest_value < 0 or principal_value + interest_value <= 0 then
    raise exception 'Payment amounts are invalid';
  end if;
  if request_key is not null then
    select payment.* into result
    from public.loan_payments as payment
    where payment.user_id = owner_id and payment.idempotency_key = request_key;
    if found then return result; end if;
  end if;

  select loan.* into loan_row
  from public.loans as loan
  where loan.id = loan_id_value and loan.user_id = owner_id
  for update;
  if not found or loan_row.status <> 'active' then
    raise exception 'This loan is no longer active';
  end if;
  if principal_value > loan_row.outstanding_principal then
    raise exception 'Principal payment exceeds the outstanding balance';
  end if;

  select wallet.* into wallet_row
  from public.wallets as wallet
  where wallet.id = wallet_id_value and wallet.user_id = owner_id
  for update;
  if not found then
    raise exception 'Wallet is no longer available';
  end if;

  if loan_row.direction = 'borrowed' then
    select coalesce(sum(contribution.amount), 0) into allocated
    from public.goal_contributions as contribution
    where contribution.wallet_id = wallet_id_value and contribution.user_id = owner_id;
    if principal_value + interest_value > wallet_row.balance - allocated then
      raise exception 'The wallet does not have enough available funds for this payment';
    end if;
  end if;

  insert into public.loan_payments (
    user_id, loan_id, wallet_id, principal_amount, interest_amount,
    paid_on, note, idempotency_key
  ) values (
    owner_id, loan_id_value, wallet_id_value, principal_value, interest_value,
    effective_paid_on, nullif(trim(note_value), ''), request_key
  ) returning * into result;

  if interest_value > 0 and loan_row.direction = 'lent' then
    insert into public.income (
      user_id, wallet_id, source, type, amount, date, is_recurring,
      is_posted, schedule_status, source_type, received_at
    ) values (
      owner_id, wallet_id_value, 'Loan interest from ' || loan_row.counterparty,
      'interest', interest_value, effective_paid_on, false,
      true, 'posted', 'manual',
      effective_paid_on::timestamp at time zone 'Asia/Manila'
    ) returning * into interest_income;
    update public.loan_payments as payment
    set interest_income_id = interest_income.id
    where payment.id = result.id
    returning payment.* into result;
  elsif interest_value > 0 then
    insert into public.expenses (
      user_id, wallet_id, merchant, category, amount, date, payment_method
    ) values (
      owner_id, wallet_id_value, 'Loan interest to ' || loan_row.counterparty,
      'Debt / Loan', interest_value, effective_paid_on, 'bank_transfer'
    ) returning * into interest_expense;
    update public.loan_payments as payment
    set interest_expense_id = interest_expense.id
    where payment.id = result.id
    returning payment.* into result;
  end if;

  update public.loans as loan
  set outstanding_principal = loan.outstanding_principal - principal_value,
      status = case
        when loan.outstanding_principal - principal_value = 0 then 'paid'
        else 'active'
      end,
      updated_at = now()
  where loan.id = loan_id_value;

  perform public.recompute_wallet_balance(wallet_id_value);
  return result;
exception when unique_violation then
  select payment.* into result
  from public.loan_payments as payment
  where payment.user_id = owner_id and payment.idempotency_key = request_key;
  return result;
end;
$$;

revoke all on function public.record_loan_payment(uuid, uuid, numeric, numeric, date, text, text) from public;
grant execute on function public.record_loan_payment(uuid, uuid, numeric, numeric, date, text, text) to authenticated;

create or replace function public.post_wallet_interest(
  target_wallet_id uuid,
  received_amount numeric,
  credited_on_value date,
  note_value text,
  request_key text
)
returns public.income
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  owner_id uuid := auth.uid();
  wallet_row public.wallets;
  result public.income;
begin
  if owner_id is null then
    raise exception 'Authentication is required';
  end if;
  if received_amount <= 0 or received_amount <> pg_catalog.trunc(received_amount, 2) then
    raise exception 'Interest amount must be a positive currency amount';
  end if;
  if request_key is null or length(trim(request_key)) < 8 then
    raise exception 'Idempotency key is required';
  end if;

  select income_row.* into result
  from public.wallet_interest_confirmations as confirmation
  join public.income as income_row on income_row.id = confirmation.income_id
  where confirmation.user_id = owner_id
    and confirmation.idempotency_key = trim(request_key);
  if found then return result; end if;

  select wallet.* into wallet_row
  from public.wallets as wallet
  where wallet.id = target_wallet_id
    and wallet.user_id = owner_id
    and wallet.account_type = 'debit'
    and wallet.account_purpose = 'savings'
    and wallet.earns_interest = true
  for update;
  if not found then
    raise exception 'Savings wallet with interest enabled not found';
  end if;

  insert into public.income (
    user_id, wallet_id, source, type, amount, date, is_recurring,
    is_posted, schedule_status, source_type, received_at
  ) values (
    owner_id, wallet_row.id,
    coalesce(nullif(trim(note_value), ''), wallet_row.name || ' interest'),
    'interest', received_amount, credited_on_value, false,
    true, 'posted', 'manual',
    credited_on_value::timestamp at time zone 'Asia/Manila'
  ) returning * into result;

  insert into public.wallet_interest_confirmations (
    user_id, wallet_id, income_id, credited_on, idempotency_key
  ) values (
    owner_id, wallet_row.id, result.id, credited_on_value, trim(request_key)
  );
  return result;
end;
$$;

revoke all on function public.post_wallet_interest(uuid, numeric, date, text, text) from public;
grant execute on function public.post_wallet_interest(uuid, numeric, date, text, text) to authenticated;

notify pgrst, 'reload schema';
