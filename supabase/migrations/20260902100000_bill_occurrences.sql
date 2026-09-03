-- Persist bill periods.  `bills` remains the editable schedule/template; a
-- bill_occurrences row is the independently payable historical obligation.
create table if not exists public.bill_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  bill_id uuid not null references public.bills(id) on delete restrict,
  occurrence_date date not null,
  occurrence_period text not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'overdue')),
  paid_at timestamptz,
  wallet_id uuid references public.wallets(id),
  expense_id uuid references public.expenses(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Date is the canonical idempotency key. A period key alone would reject
  -- legitimate weekly occurrences in the same month.
  unique (bill_id, occurrence_date)
);

create index if not exists bill_occurrences_user_period_idx on public.bill_occurrences(user_id, occurrence_period, occurrence_date);
alter table public.bill_occurrences enable row level security;
create policy "bill_occurrences_select_own" on public.bill_occurrences for select using (auth.uid() = user_id);
create policy "bill_occurrences_insert_own" on public.bill_occurrences for insert with check (auth.uid() = user_id);
create policy "bill_occurrences_update_own" on public.bill_occurrences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.bills add column if not exists recurrence_status text not null default 'active'
  check (recurrence_status in ('active', 'paused', 'archived'));
alter table public.bills add column if not exists recurrence_ends_on date;
alter table public.expenses add column if not exists source_bill_occurrence_id uuid references public.bill_occurrences(id) on delete restrict;
create unique index if not exists expenses_one_bill_occurrence_id_idx
  on public.expenses(source_bill_occurrence_id) where source_bill_occurrence_id is not null and deleted_at is null;

-- The prior trigger copied a schedule edit into a historical payment expense.
drop trigger if exists bills_sync_linked_expense on public.bills;

create or replace function public.bill_date_from_anchor(anchor date, frequency text, occurrence_index integer)
returns date language plpgsql immutable as $$
declare v_months integer; v_target date; v_last integer;
begin
  if frequency = 'weekly' then return anchor + occurrence_index * 7; end if;
  v_months := case frequency when 'quarterly' then 3 when 'yearly' then 12 else 1 end;
  v_target := (date_trunc('month', anchor)::date + ((occurrence_index * v_months) || ' months')::interval)::date;
  v_last := extract(day from (date_trunc('month', v_target) + interval '1 month - 1 day'))::integer;
  return v_target + least(extract(day from anchor)::integer, v_last) - 1;
end $$;

create or replace function public.reconcile_bill_occurrences(target_user_id uuid default null, target_through date default null)
returns table(created integer, skipped integer, invalid integer, failed integer)
language plpgsql security definer set search_path = public as $$
declare b record; v_through date; v_date date; v_index integer; v_created integer := 0; v_skipped integer := 0; v_invalid integer := 0; v_failed integer := 0;
begin
  if target_user_id is null and auth.role() <> 'service_role' then target_user_id := auth.uid(); end if;
  if target_user_id is null and auth.role() <> 'service_role' then raise exception 'authentication required'; end if;
  if auth.uid() is not null and auth.role() <> 'service_role' and auth.uid() <> target_user_id then raise exception 'not authorized'; end if;
  v_through := coalesce(target_through, (date_trunc('month', timezone('Asia/Manila', now())) + interval '1 month - 1 day')::date);
  for b in select * from public.bills where (target_user_id is null or user_id = target_user_id) and deleted_at is null loop
    -- Preserve legacy paid history before creating the following period.
    if b.recurring and (b.paid_occurrence_date is not null or b.status = 'paid') then
      insert into public.bill_occurrences(user_id, bill_id, occurrence_date, occurrence_period, status, paid_at, wallet_id)
      values (b.user_id, b.id, coalesce(b.paid_occurrence_date, b.due_date), to_char(coalesce(b.paid_occurrence_date, b.due_date), 'YYYY-MM'), 'paid', b.paid_at, b.wallet_id)
      on conflict (bill_id, occurrence_date) do nothing;
    elsif not b.recurring then
      insert into public.bill_occurrences(user_id, bill_id, occurrence_date, occurrence_period, status, paid_at, wallet_id)
      values (b.user_id, b.id, b.due_date, to_char(b.due_date, 'YYYY-MM'), case when b.status = 'paid' then 'paid' else 'unpaid' end, b.paid_at, b.wallet_id)
      on conflict (bill_id, occurrence_date) do nothing;
      continue;
    end if;
    if not b.recurring or b.frequency is null or b.recurrence_status <> 'active' then v_skipped := v_skipped + 1; continue; end if;
    -- due_date is the template anchor/next legacy schedule date. Do not infer a
    -- prior recurrence configuration that is absent from the record.
    v_index := 0;
    loop
      v_date := public.bill_date_from_anchor(b.due_date, b.frequency, v_index);
      exit when v_date > v_through;
      exit when b.recurrence_ends_on is not null and v_date > b.recurrence_ends_on;
      begin
        insert into public.bill_occurrences(user_id, bill_id, occurrence_date, occurrence_period, status, wallet_id)
        values (b.user_id, b.id, v_date, to_char(v_date, 'YYYY-MM'), 'unpaid', b.wallet_id)
        on conflict (bill_id, occurrence_date) do nothing;
        if found then v_created := v_created + 1; else v_skipped := v_skipped + 1; end if;
      exception when others then v_failed := v_failed + 1; end;
      v_index := v_index + 1;
      if v_index > 2400 then v_invalid := v_invalid + 1; exit; end if;
    end loop;
  end loop;
  return query select v_created, v_skipped, v_invalid, v_failed;
end $$;
grant execute on function public.reconcile_bill_occurrences(uuid, date) to authenticated, service_role;

-- Backfill every legacy schedule once, including its historical paid occurrence.
select public.reconcile_bill_occurrences(id, (date_trunc('month', timezone('Asia/Manila', now())) + interval '1 month - 1 day')::date)
from public.users;

drop function if exists public.mark_bill_paid(uuid, uuid, date, date);
create function public.mark_bill_paid(target_bill_id uuid, selected_wallet_id uuid, selected_payment_date date, selected_occurrence_date date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_occurrence public.bill_occurrences%rowtype; v_expense public.expenses%rowtype;
begin
  select o.* into v_occurrence from public.bill_occurrences o
   join public.bills b on b.id = o.bill_id
   where o.bill_id = target_bill_id and o.occurrence_date = selected_occurrence_date and o.user_id = auth.uid() and b.deleted_at is null for update;
  if not found then raise exception 'bill occurrence changed'; end if;
  if v_occurrence.status = 'paid' or v_occurrence.expense_id is not null then raise exception 'bill already paid'; end if;
  if not exists(select 1 from public.wallets where id = selected_wallet_id and user_id = auth.uid()) then raise exception 'wallet does not belong to user'; end if;
  insert into public.expenses(user_id, amount, category, merchant, date, payment_method, wallet_id, source_bill_id, source_bill_occurrence_date, source_bill_occurrence_id)
  select b.user_id, b.amount, b.category, b.title, selected_payment_date, 'other', selected_wallet_id, b.id, v_occurrence.occurrence_date, v_occurrence.id from public.bills b where b.id = target_bill_id
  returning * into v_expense;
  update public.bill_occurrences set status = 'paid', paid_at = selected_payment_date::timestamptz, wallet_id = selected_wallet_id, expense_id = v_expense.id, updated_at = now() where id = v_occurrence.id;
  return jsonb_build_object('occurrence', (select to_jsonb(o) from public.bill_occurrences o where o.id = v_occurrence.id), 'expense', to_jsonb(v_expense));
end $$;
grant execute on function public.mark_bill_paid(uuid, uuid, date, date) to authenticated;
