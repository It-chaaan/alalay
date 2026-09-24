-- Paying a credit-card bill occurrence is a principal repayment, not a new
-- expense. The occurrence-ledger migration replaced this branch with the
-- generic bill expense path and also left the repayment RPC validating only
-- the bill template date. Restore the canonical accounting path against the
-- independently payable occurrence row.
create or replace function public.repay_credit_account(
  target_credit_wallet_id uuid,
  selected_payment_wallet_id uuid,
  principal_value numeric,
  interest_value numeric,
  fee_value numeric,
  selected_payment_date date,
  request_key text,
  source_bill_id_value uuid,
  source_bill_occurrence_date_value date
)
returns public.credit_repayments
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  credit_wallet_row public.wallets%rowtype;
  payment_wallet_row public.wallets%rowtype;
  repayment_row public.credit_repayments%rowtype;
  bill_row public.bills%rowtype;
  interest_expense_row public.expenses%rowtype;
  fee_expense_row public.expenses%rowtype;
  total_value numeric;
  available_value numeric;
begin
  if owner_id is null then raise exception 'authentication required'; end if;
  if principal_value is null or principal_value <= 0 then raise exception 'principal must be greater than zero'; end if;
  if coalesce(interest_value, 0) < 0 then raise exception 'interest cannot be negative'; end if;
  if coalesce(fee_value, 0) < 0 then raise exception 'fee cannot be negative'; end if;
  if request_key is null or length(trim(request_key)) < 16 then raise exception 'idempotency key is required'; end if;

  select r.* into repayment_row
  from public.credit_repayments as r
  where r.user_id = owner_id and r.idempotency_key = trim(request_key);
  if found then return repayment_row; end if;

  select w.* into credit_wallet_row
  from public.wallets as w
  where w.id = target_credit_wallet_id
    and w.user_id = owner_id
    and w.account_type = 'credit'
  for update;
  if not found then raise exception 'credit wallet not found'; end if;

  select w.* into payment_wallet_row
  from public.wallets as w
  where w.id = selected_payment_wallet_id
    and w.user_id = owner_id
    and w.account_type is distinct from 'credit'
  for update;
  if not found then raise exception 'payment wallet is not available'; end if;

  total_value := principal_value + coalesce(interest_value, 0) + coalesce(fee_value, 0);
  available_value := coalesce(payment_wallet_row.balance, 0) - coalesce((
    select sum(gc.amount)
    from public.goal_contributions as gc
    where gc.wallet_id = selected_payment_wallet_id
  ), 0);
  if total_value > available_value then raise exception 'not enough available balance'; end if;
  if principal_value > greatest(coalesce(credit_wallet_row.balance, 0), 0) then
    raise exception 'repayment exceeds outstanding balance';
  end if;

  if source_bill_id_value is not null then
    select b.* into bill_row
    from public.bills as b
    where b.id = source_bill_id_value
      and b.user_id = owner_id
      and b.deleted_at is null
    for update;
    if not found or bill_row.credit_wallet_id is distinct from target_credit_wallet_id then
      raise exception 'credit bill does not belong to credit wallet';
    end if;
    if source_bill_occurrence_date_value is null
      or not exists (
        select 1
        from public.bill_occurrences as o
        where o.bill_id = bill_row.id
          and o.user_id = owner_id
          and o.occurrence_date = source_bill_occurrence_date_value
      ) then
      raise exception 'bill occurrence changed';
    end if;
  end if;

  insert into public.credit_repayments (
    user_id, credit_wallet_id, payment_wallet_id, principal_amount,
    interest_amount, fee_amount, payment_date, idempotency_key,
    source_bill_id, source_bill_occurrence_date
  ) values (
    owner_id, target_credit_wallet_id, selected_payment_wallet_id, principal_value,
    coalesce(interest_value, 0), coalesce(fee_value, 0), selected_payment_date,
    trim(request_key), source_bill_id_value, source_bill_occurrence_date_value
  ) returning * into repayment_row;

  if coalesce(interest_value, 0) > 0 then
    insert into public.expenses (
      user_id, amount, category, custom_category, merchant, date,
      payment_method, wallet_id, credit_repayment_id
    ) values (
      owner_id, interest_value, 'Debt / Loan', null,
      'Credit card interest - ' || credit_wallet_row.name,
      selected_payment_date, 'bank_transfer', selected_payment_wallet_id, repayment_row.id
    ) returning * into interest_expense_row;
  end if;

  if coalesce(fee_value, 0) > 0 then
    insert into public.expenses (
      user_id, amount, category, custom_category, merchant, date,
      payment_method, wallet_id, credit_repayment_id
    ) values (
      owner_id, fee_value, 'Bank Fees', null,
      'Credit card payment fee - ' || credit_wallet_row.name,
      selected_payment_date, 'bank_transfer', selected_payment_wallet_id, repayment_row.id
    ) returning * into fee_expense_row;
  end if;

  update public.credit_repayments
  set interest_expense_id = interest_expense_row.id,
      fee_expense_id = fee_expense_row.id
  where id = repayment_row.id;

  perform public.recompute_wallet_balance(target_credit_wallet_id);
  perform public.recompute_wallet_balance(selected_payment_wallet_id);
  select r.* into repayment_row from public.credit_repayments as r where r.id = repayment_row.id;
  return repayment_row;
end;
$$;

create or replace function public.mark_bill_paid(
  target_bill_id uuid,
  selected_wallet_id uuid,
  selected_payment_date date,
  selected_occurrence_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  bill_row public.bills%rowtype;
  occurrence_row public.bill_occurrences%rowtype;
  expense_row public.expenses%rowtype;
  repayment_row public.credit_repayments%rowtype;
begin
  if owner_id is null then raise exception 'authentication required'; end if;

  select o.* into occurrence_row
  from public.bill_occurrences as o
  join public.bills as b on b.id = o.bill_id
  where o.bill_id = target_bill_id
    and o.occurrence_date = selected_occurrence_date
    and o.user_id = owner_id
    and b.deleted_at is null
  for update of o;
  if not found then raise exception 'bill occurrence changed'; end if;
  if occurrence_row.status = 'paid' or occurrence_row.expense_id is not null then
    raise exception 'bill already paid';
  end if;

  select b.* into bill_row
  from public.bills as b
  where b.id = target_bill_id and b.user_id = owner_id and b.deleted_at is null;

  if bill_row.credit_wallet_id is not null then
    select * into repayment_row
    from public.repay_credit_account(
      bill_row.credit_wallet_id,
      selected_wallet_id,
      bill_row.amount,
      0,
      0,
      selected_payment_date,
      'bill:' || bill_row.id || ':' || occurrence_row.occurrence_date::text,
      bill_row.id,
      occurrence_row.occurrence_date
    );
  else
    if not exists (
      select 1 from public.wallets
      where id = selected_wallet_id and user_id = owner_id
    ) then
      raise exception 'wallet does not belong to user';
    end if;

    insert into public.expenses (
      user_id, amount, category, merchant, date, payment_method, wallet_id,
      source_bill_id, source_bill_occurrence_date, source_bill_occurrence_id
    ) values (
      owner_id, bill_row.amount, bill_row.category, bill_row.title,
      selected_payment_date, 'other', selected_wallet_id, bill_row.id,
      occurrence_row.occurrence_date, occurrence_row.id
    ) returning * into expense_row;
  end if;

  update public.bill_occurrences
  set status = 'paid',
      paid_at = selected_payment_date::timestamptz,
      wallet_id = selected_wallet_id,
      expense_id = expense_row.id,
      updated_at = now()
  where id = occurrence_row.id;

  select o.* into occurrence_row
  from public.bill_occurrences as o
  where o.id = occurrence_row.id;

  return jsonb_build_object(
    'occurrence', to_jsonb(occurrence_row),
    'expense', case when expense_row.id is null then null else to_jsonb(expense_row) end,
    'repayment', case when repayment_row.id is null then null else to_jsonb(repayment_row) end
  );
end;
$$;

revoke all on function public.repay_credit_account(uuid, uuid, numeric, numeric, numeric, date, text, uuid, date)
  from public, anon, service_role;
grant execute on function public.repay_credit_account(uuid, uuid, numeric, numeric, numeric, date, text, uuid, date)
  to authenticated;

revoke all on function public.mark_bill_paid(uuid, uuid, date, date)
  from public, anon, service_role;
grant execute on function public.mark_bill_paid(uuid, uuid, date, date) to authenticated;

notify pgrst, 'reload schema';
