-- A paid bill occurrence is represented by one linked expense. The bill remains
-- the schedule/status record; the expense is the wallet-impacting ledger event.
alter table public.bills
  add column if not exists paid_occurrence_date date;

alter table public.expenses
  add column if not exists source_bill_id uuid references public.bills(id) on delete restrict;

alter table public.expenses
  add column if not exists source_bill_occurrence_date date;

create index if not exists expenses_source_bill_idx
  on public.expenses (source_bill_id)
  where source_bill_id is not null and deleted_at is null;

create unique index if not exists expenses_one_bill_occurrence_idx
  on public.expenses (source_bill_id, source_bill_occurrence_date)
  where source_bill_id is not null and source_bill_occurrence_date is not null and deleted_at is null;

create or replace function public.sync_bill_expense()
returns trigger as $$
begin
  update public.expenses e
  set amount = new.amount,
      category = new.category,
      merchant = new.title,
      wallet_id = new.wallet_id
  where e.source_bill_id = new.id
    and e.source_bill_occurrence_date = coalesce(new.paid_occurrence_date, old.paid_occurrence_date)
    and e.deleted_at is null;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists bills_sync_linked_expense on public.bills;
create trigger bills_sync_linked_expense
after update of title, amount, category, wallet_id, paid_occurrence_date on public.bills
for each row execute function public.sync_bill_expense();

create or replace function public.recompute_wallet_balance(target_wallet_id uuid)
returns void as $$
begin
  update public.wallets w
  set balance =
    coalesce((select sum(i.amount) from public.income i where i.wallet_id = target_wallet_id and i.deleted_at is null), 0)
    + coalesce((select sum(a.amount) from public.wallet_adjustments a where a.wallet_id = target_wallet_id), 0)
    - coalesce((select sum(e.amount) from public.expenses e where e.wallet_id = target_wallet_id and e.deleted_at is null), 0)
    - coalesce((select sum(b.amount)
      from public.bills b
      where b.wallet_id = target_wallet_id
        and b.status = 'paid'
        and b.deleted_at is null
        and not exists (
          select 1 from public.expenses e
          where e.source_bill_id = b.id and e.deleted_at is null
        )), 0)
  where w.id = target_wallet_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.add_bill_cycle(value date, frequency text)
returns date as $$
declare
  months integer;
  original_day integer;
  next_date date;
begin
  if frequency = 'weekly' then return value + 7; end if;
  months := case when frequency = 'quarterly' then 3 when frequency = 'yearly' then 12 else 1 end;
  original_day := extract(day from value)::integer;
  next_date := date_trunc('month', value)::date + (months || ' months')::interval;
  return next_date + least(original_day - 1, extract(day from (date_trunc('month', next_date) + interval '1 month - 1 day'))::integer - 1);
end;
$$ language plpgsql immutable;

create or replace function public.mark_bill_paid(
  target_bill_id uuid,
  selected_wallet_id uuid,
  selected_payment_date date
)
returns jsonb as $$
declare
  bill_row public.bills%rowtype;
  wallet_row public.wallets%rowtype;
  expense_row public.expenses%rowtype;
  occurrence_date date;
  next_due_date date;
  payment_timestamp timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into bill_row
  from public.bills
  where id = target_bill_id and user_id = auth.uid() and deleted_at is null
  for update;

  if not found then raise exception 'bill not found'; end if;

  select * into wallet_row
  from public.wallets
  where id = selected_wallet_id and user_id = auth.uid();

  if not found then raise exception 'wallet does not belong to user'; end if;

  occurrence_date := bill_row.due_date;
  payment_timestamp := selected_payment_date::timestamptz;

  if (not coalesce(bill_row.recurring, false) and bill_row.status = 'paid')
    or (coalesce(bill_row.recurring, false) and bill_row.paid_occurrence_date = occurrence_date) then
    raise exception 'bill already paid';
  end if;

  select * into expense_row
  from public.expenses
  where source_bill_id = bill_row.id
    and source_bill_occurrence_date = occurrence_date
    and deleted_at is null
  for update;

  if found then
    raise exception 'bill already paid';
  end if;

  insert into public.expenses (
    user_id, amount, category, custom_category, merchant, date,
    payment_method, wallet_id, source_bill_id, source_bill_occurrence_date
  ) values (
    auth.uid(), bill_row.amount, bill_row.category, null, bill_row.title,
    selected_payment_date, 'other', selected_wallet_id, bill_row.id, occurrence_date
  ) returning * into expense_row;

  if coalesce(bill_row.recurring, false) and bill_row.frequency is not null then
    next_due_date := public.add_bill_cycle(bill_row.due_date, bill_row.frequency);
    update public.bills
    set status = 'unpaid', paid_at = payment_timestamp, paid_occurrence_date = occurrence_date,
        due_date = next_due_date, wallet_id = selected_wallet_id
    where id = bill_row.id;
  else
    update public.bills
    set status = 'paid', paid_at = payment_timestamp, paid_occurrence_date = occurrence_date,
        wallet_id = selected_wallet_id
    where id = bill_row.id;
  end if;

  select * into bill_row from public.bills where id = bill_row.id;
  return jsonb_build_object('bill', to_jsonb(bill_row), 'expense', to_jsonb(expense_row));
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.mark_bill_paid(uuid, uuid, date) from public;
grant execute on function public.mark_bill_paid(uuid, uuid, date) to authenticated;
