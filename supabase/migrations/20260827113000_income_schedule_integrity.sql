-- Separate an income schedule definition from a posted income transaction.
-- Existing rows are historical posted transactions; only new future rows are
-- created as active schedules by the API.
alter table public.income
  add column if not exists is_posted boolean not null default true,
  add column if not exists schedule_status text not null default 'posted',
  add column if not exists schedule_id uuid references public.income(id) on delete restrict,
  add column if not exists occurrence_key text;

alter table public.income
  add constraint income_schedule_status_check
  check (schedule_status in ('posted', 'active', 'completed', 'cancelled'));

create unique index if not exists income_occurrence_key_unique
  on public.income (occurrence_key)
  where occurrence_key is not null;

create index if not exists income_active_schedule_due_idx
  on public.income (date)
  where is_posted = false and schedule_status = 'active' and deleted_at is null;

create or replace function public.add_income_cycle(value date, frequency text)
returns date
language plpgsql
immutable
as $$
declare
  months integer;
  original_day integer;
  next_month date;
begin
  if frequency = 'weekly' then return value + 7; end if;
  if frequency = 'biweekly' then return value + 14; end if;
  if frequency = 'yearly' then months := 12; else months := 1; end if;
  original_day := extract(day from value)::integer;
  next_month := (date_trunc('month', value) + (months || ' months')::interval)::date;
  return next_month + least(original_day - 1, extract(day from (next_month + interval '1 month - 1 day'))::integer - 1);
end;
$$;

-- Recompute stored balances from posted income only. The function remains
-- security-definer because it is called by the existing balance triggers.
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
      + coalesce((select sum(b.amount) from public.bills as b where b.wallet_id = target_wallet_id and b.credit_wallet_id is null and b.status = 'paid' and b.deleted_at is null and not exists (select 1 from public.expenses as e where e.source_bill_id = b.id and e.deleted_at is null)), 0)
      - coalesce((select sum(r.principal_amount) from public.credit_repayments as r where r.credit_wallet_id = target_wallet_id), 0)
    else
      coalesce((select sum(i.amount) from public.income as i where i.wallet_id = target_wallet_id and i.is_posted and i.schedule_status = 'posted' and i.deleted_at is null), 0)
      + coalesce((select sum(a.amount) from public.wallet_adjustments as a where a.wallet_id = target_wallet_id), 0)
      - coalesce((select sum(e.amount) from public.expenses as e where e.wallet_id = target_wallet_id and e.deleted_at is null), 0)
      - coalesce((select sum(b.amount) from public.bills as b where b.wallet_id = target_wallet_id and b.credit_wallet_id is null and b.status = 'paid' and b.deleted_at is null and not exists (select 1 from public.expenses as e where e.source_bill_id = b.id and e.deleted_at is null)), 0)
      - coalesce((select sum(t.amount) from public.wallet_transfers as t where t.from_wallet_id = target_wallet_id), 0)
      + coalesce((select sum(t.amount) from public.wallet_transfers as t where t.to_wallet_id = target_wallet_id), 0)
      - coalesce((select sum(l.original_principal) from public.loans as l where l.wallet_id = target_wallet_id and l.direction = 'lent'), 0)
      + coalesce((select sum(l.original_principal) from public.loans as l where l.wallet_id = target_wallet_id and l.direction = 'borrowed'), 0)
      + coalesce((select sum(p.principal_amount) from public.loan_payments as p join public.loans as l on l.id = p.loan_id where p.wallet_id = target_wallet_id and l.direction = 'lent'), 0)
      - coalesce((select sum(p.principal_amount) from public.loan_payments as p join public.loans as l on l.id = p.loan_id where p.wallet_id = target_wallet_id and l.direction = 'borrowed'), 0)
      - coalesce((select sum(r.principal_amount) from public.credit_repayments as r where r.payment_wallet_id = target_wallet_id), 0)
  end
  where w.id = target_wallet_id;
end;
$$;

-- The scheduler calls this as service_role. Each invocation is one database
-- transaction; row locks plus occurrence_key make retries and overlap safe.
create or replace function public.process_due_income_schedules()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  schedule_row public.income%rowtype;
  posted_id uuid;
  occurrence text;
  due_today date := (now() at time zone 'Asia/Manila')::date;
  processed integer := 0;
begin
  for schedule_row in
    select * from public.income
    where is_posted = false and schedule_status = 'active' and deleted_at is null and date <= due_today
    order by date, id
    for update skip locked
  loop
    occurrence := schedule_row.id::text || ':' || schedule_row.date::text;
    insert into public.income (user_id, wallet_id, source, type, custom_type, amount, date, is_recurring, frequency, is_posted, schedule_status, schedule_id, occurrence_key)
    values (schedule_row.user_id, schedule_row.wallet_id, schedule_row.source, schedule_row.type, schedule_row.custom_type, schedule_row.amount, schedule_row.date, false, null, true, 'posted', schedule_row.id, occurrence)
    on conflict (occurrence_key) do nothing
    returning id into posted_id;

    if posted_id is not null then
      processed := processed + 1;
    end if;

    if coalesce(schedule_row.is_recurring, false) then
      update public.income
      set date = public.add_income_cycle(schedule_row.date, schedule_row.frequency), updated_at = now()
      where id = schedule_row.id;
    else
      update public.income
      set schedule_status = 'completed', updated_at = now()
      where id = schedule_row.id;
    end if;
  end loop;
  return processed;
end;
$$;

revoke all on function public.process_due_income_schedules() from public;
grant execute on function public.process_due_income_schedules() to service_role;
