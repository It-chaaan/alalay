-- Credit-card repayment is a liability settlement, not a new expense.
-- Interest and fees remain ordinary expense rows so reports keep actual cost.
create table if not exists public.credit_repayments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  credit_wallet_id uuid not null references public.wallets(id) on delete restrict,
  payment_wallet_id uuid not null references public.wallets(id) on delete restrict,
  principal_amount numeric not null check (principal_amount > 0),
  interest_amount numeric not null default 0 check (interest_amount >= 0),
  fee_amount numeric not null default 0 check (fee_amount >= 0),
  payment_date date not null default current_date,
  idempotency_key text,
  source_bill_id uuid references public.bills(id) on delete restrict,
  source_bill_occurrence_date date,
  interest_expense_id uuid references public.expenses(id) on delete restrict,
  fee_expense_id uuid references public.expenses(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint credit_repayments_different_wallets
    check (credit_wallet_id <> payment_wallet_id)
);

alter table public.expenses
  add column if not exists credit_repayment_id uuid
  references public.credit_repayments(id) on delete restrict;

alter table public.bills
  add column if not exists credit_wallet_id uuid
  references public.wallets(id) on delete set null;

create unique index if not exists credit_repayments_user_idempotency_idx
  on public.credit_repayments (user_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists credit_repayments_bill_occurrence_idx
  on public.credit_repayments (source_bill_id, source_bill_occurrence_date)
  where source_bill_id is not null and source_bill_occurrence_date is not null;

create index if not exists credit_repayments_credit_wallet_idx
  on public.credit_repayments (credit_wallet_id, payment_date desc);

create index if not exists credit_repayments_payment_wallet_idx
  on public.credit_repayments (payment_wallet_id, payment_date desc);

create or replace function public.validate_bill_credit_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.credit_wallet_id is not null and not exists (
    select 1
    from public.wallets as w
    where w.id = new.credit_wallet_id
      and w.user_id = new.user_id
      and w.account_type = 'credit'
  ) then
    raise exception 'credit wallet does not belong to user';
  end if;
  return new;
end;
$$;

drop trigger if exists bills_validate_credit_wallet on public.bills;
create trigger bills_validate_credit_wallet
before insert or update of user_id, credit_wallet_id on public.bills
for each row execute function public.validate_bill_credit_wallet();

create or replace function public.recompute_wallet_balance(target_wallet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.wallets as w
  set balance = case
    when w.account_type = 'credit' then
      coalesce((select sum(a.amount) from public.wallet_adjustments as a where a.wallet_id = target_wallet_id), 0)
      + coalesce((select sum(e.amount) from public.expenses as e where e.wallet_id = target_wallet_id and e.deleted_at is null), 0)
      + coalesce((
        select sum(b.amount)
        from public.bills as b
        where b.wallet_id = target_wallet_id
          and b.credit_wallet_id is null
          and b.status = 'paid'
          and b.deleted_at is null
          and not exists (
            select 1 from public.expenses as e
            where e.source_bill_id = b.id and e.deleted_at is null
          )
      ), 0)
      - coalesce((select sum(r.principal_amount) from public.credit_repayments as r where r.credit_wallet_id = target_wallet_id), 0)
    else
      coalesce((select sum(i.amount) from public.income as i where i.wallet_id = target_wallet_id and i.deleted_at is null), 0)
      + coalesce((select sum(a.amount) from public.wallet_adjustments as a where a.wallet_id = target_wallet_id), 0)
      - coalesce((select sum(e.amount) from public.expenses as e where e.wallet_id = target_wallet_id and e.deleted_at is null), 0)
      - coalesce((
        select sum(b.amount)
        from public.bills as b
        where b.wallet_id = target_wallet_id
          and b.credit_wallet_id is null
          and b.status = 'paid'
          and b.deleted_at is null
          and not exists (
            select 1 from public.expenses as e
            where e.source_bill_id = b.id and e.deleted_at is null
          )
      ), 0)
      - coalesce((select sum(t.amount) from public.wallet_transfers as t where t.from_wallet_id = target_wallet_id), 0)
      + coalesce((select sum(t.amount) from public.wallet_transfers as t where t.to_wallet_id = target_wallet_id), 0)
      - coalesce((select sum(l.original_principal) from public.loans as l where l.wallet_id = target_wallet_id and l.direction = 'lent'), 0)
      + coalesce((select sum(l.original_principal) from public.loans as l where l.wallet_id = target_wallet_id and l.direction = 'borrowed'), 0)
      + coalesce((
        select sum(p.principal_amount)
        from public.loan_payments as p
        join public.loans as l on l.id = p.loan_id
        where p.wallet_id = target_wallet_id and l.direction = 'lent'
      ), 0)
      - coalesce((
        select sum(p.principal_amount)
        from public.loan_payments as p
        join public.loans as l on l.id = p.loan_id
        where p.wallet_id = target_wallet_id and l.direction = 'borrowed'
      ), 0)
      - coalesce((select sum(r.principal_amount) from public.credit_repayments as r where r.payment_wallet_id = target_wallet_id), 0)
  end
  where w.id = target_wallet_id;
end;
$$;

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
      or bill_row.due_date <> source_bill_occurrence_date_value then
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

drop function if exists public.mark_bill_paid(uuid, uuid, date, date);

create function public.mark_bill_paid(
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
  bill_row public.bills%rowtype;
  wallet_row public.wallets%rowtype;
  expense_row public.expenses%rowtype;
  repayment_row public.credit_repayments%rowtype;
  v_occurrence_date date;
  next_due_date date;
  payment_timestamp timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select b.* into bill_row
  from public.bills as b
  where b.id = target_bill_id and b.user_id = auth.uid() and b.deleted_at is null
  for update;
  if not found then raise exception 'bill not found'; end if;
  if bill_row.due_date <> selected_occurrence_date then raise exception 'bill occurrence changed'; end if;

  select w.* into wallet_row
  from public.wallets as w
  where w.id = selected_wallet_id and w.user_id = auth.uid();
  if not found then raise exception 'wallet does not belong to user'; end if;

  v_occurrence_date := bill_row.due_date;
  payment_timestamp := selected_payment_date::timestamptz;
  if (not coalesce(bill_row.recurring, false) and bill_row.status = 'paid')
    or (coalesce(bill_row.recurring, false) and bill_row.paid_occurrence_date = v_occurrence_date) then
    raise exception 'bill already paid';
  end if;

  select e.* into expense_row
  from public.expenses as e
  where e.source_bill_id = bill_row.id
    and e.source_bill_occurrence_date = v_occurrence_date
    and e.deleted_at is null
  for update;
  if found then raise exception 'bill already paid'; end if;

  if bill_row.credit_wallet_id is not null then
    select r.* into repayment_row
    from public.credit_repayments as r
    where r.source_bill_id = bill_row.id
      and r.source_bill_occurrence_date = v_occurrence_date
    for update;
    if found then raise exception 'bill already paid'; end if;

    select * into repayment_row
    from public.repay_credit_account(
      bill_row.credit_wallet_id, selected_wallet_id, bill_row.amount, 0, 0,
      selected_payment_date, 'bill:' || bill_row.id || ':' || v_occurrence_date::text,
      bill_row.id, v_occurrence_date
    );
  end if;

  if bill_row.credit_wallet_id is null then
    insert into public.expenses (
      user_id, amount, category, custom_category, merchant, date,
      payment_method, wallet_id, source_bill_id, source_bill_occurrence_date
    ) values (
      auth.uid(), bill_row.amount, bill_row.category, null, bill_row.title,
      selected_payment_date, 'other', selected_wallet_id, bill_row.id, v_occurrence_date
    ) returning * into expense_row;
  end if;

  if coalesce(bill_row.recurring, false) and bill_row.frequency is not null then
    next_due_date := public.add_bill_cycle(bill_row.due_date, bill_row.frequency);
    update public.bills
    set status = 'unpaid', paid_at = payment_timestamp,
        paid_occurrence_date = v_occurrence_date, due_date = next_due_date,
        wallet_id = selected_wallet_id
    where id = bill_row.id;
  else
    update public.bills
    set status = 'paid', paid_at = payment_timestamp,
        paid_occurrence_date = v_occurrence_date, wallet_id = selected_wallet_id
    where id = bill_row.id;
  end if;

  select * into bill_row from public.bills where id = bill_row.id;
  return jsonb_build_object(
    'bill', to_jsonb(bill_row),
    'expense', case when expense_row.id is null then null else to_jsonb(expense_row) end,
    'repayment', case when repayment_row.id is null then null else to_jsonb(repayment_row) end
  );
end;
$$;

alter table public.credit_repayments enable row level security;
drop policy if exists credit_repayments_select_own on public.credit_repayments;
create policy credit_repayments_select_own on public.credit_repayments
for select using (auth.uid() = user_id);

revoke all on table public.credit_repayments from public;
grant select on table public.credit_repayments to authenticated;
revoke all on function public.validate_bill_credit_wallet() from public;
grant execute on function public.validate_bill_credit_wallet() to service_role;
revoke all on function public.repay_credit_account(uuid, uuid, numeric, numeric, numeric, date, text, uuid, date) from public;
grant execute on function public.repay_credit_account(uuid, uuid, numeric, numeric, numeric, date, text, uuid, date) to authenticated;
revoke all on function public.mark_bill_paid(uuid, uuid, date, date) from public;
grant execute on function public.mark_bill_paid(uuid, uuid, date, date) to authenticated;
