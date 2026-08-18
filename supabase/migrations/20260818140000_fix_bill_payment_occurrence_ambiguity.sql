-- expenses.occurrence_date (subscription billing) conflicts with the former
-- mark_bill_paid local variable of the same name during the duplicate check.
-- Keep the public RPC signature stable and make every financial-row reference
-- explicit so PL/pgSQL name resolution cannot change the payment target.
create or replace function public.mark_bill_paid(
  target_bill_id uuid,
  selected_wallet_id uuid,
  selected_payment_date date
)
returns jsonb as $$
declare
  v_bill public.bills%rowtype;
  v_wallet public.wallets%rowtype;
  v_expense public.expenses%rowtype;
  v_occurrence_date date;
  v_next_due_date date;
  v_payment_timestamp timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select b.* into v_bill
  from public.bills as b
  where b.id = target_bill_id
    and b.user_id = auth.uid()
    and b.deleted_at is null
  for update of b;

  if not found then raise exception 'bill not found'; end if;

  select w.* into v_wallet
  from public.wallets as w
  where w.id = selected_wallet_id
    and w.user_id = auth.uid();

  if not found then raise exception 'wallet does not belong to user'; end if;

  v_occurrence_date := v_bill.due_date;
  v_payment_timestamp := selected_payment_date::timestamptz;

  if (not coalesce(v_bill.recurring, false) and v_bill.status = 'paid')
    or (
      coalesce(v_bill.recurring, false)
      and v_bill.paid_occurrence_date = v_occurrence_date
    ) then
    raise exception 'bill already paid';
  end if;

  select e.* into v_expense
  from public.expenses as e
  where e.source_bill_id = v_bill.id
    and e.source_bill_occurrence_date = v_occurrence_date
    and e.deleted_at is null
  for update of e;

  if found then
    raise exception 'bill already paid';
  end if;

  insert into public.expenses as e (
    user_id,
    amount,
    category,
    custom_category,
    merchant,
    date,
    payment_method,
    wallet_id,
    source_bill_id,
    source_bill_occurrence_date
  ) values (
    auth.uid(),
    v_bill.amount,
    v_bill.category,
    null,
    v_bill.title,
    selected_payment_date,
    'other',
    selected_wallet_id,
    v_bill.id,
    v_occurrence_date
  ) returning e.* into v_expense;

  if coalesce(v_bill.recurring, false) and v_bill.frequency is not null then
    v_next_due_date := public.add_bill_cycle(v_bill.due_date, v_bill.frequency);
    update public.bills as b
    set status = 'unpaid',
        paid_at = v_payment_timestamp,
        paid_occurrence_date = v_occurrence_date,
        due_date = v_next_due_date,
        wallet_id = selected_wallet_id
    where b.id = v_bill.id;
  else
    update public.bills as b
    set status = 'paid',
        paid_at = v_payment_timestamp,
        paid_occurrence_date = v_occurrence_date,
        wallet_id = selected_wallet_id
    where b.id = v_bill.id;
  end if;

  select b.* into v_bill
  from public.bills as b
  where b.id = v_bill.id;

  return jsonb_build_object('bill', to_jsonb(v_bill), 'expense', to_jsonb(v_expense));
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.mark_bill_paid(uuid, uuid, date) from public;
grant execute on function public.mark_bill_paid(uuid, uuid, date) to authenticated;
