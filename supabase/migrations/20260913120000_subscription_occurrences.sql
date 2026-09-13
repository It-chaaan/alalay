-- Immutable subscription occurrence ledger. Unlike subscriptions.renewal_date,
-- these rows survive schedule advancement and can safely drive reminders.
create table if not exists public.subscription_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  occurrence_date date not null,
  amount numeric not null check (amount >= 0),
  wallet_id uuid references public.wallets(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  recurrence_key text not null,
  generated_expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, occurrence_date),
  unique (user_id, recurrence_key)
);

create index if not exists subscription_occurrences_user_date_idx
  on public.subscription_occurrences (user_id, occurrence_date desc);
create index if not exists subscription_occurrences_subscription_date_idx
  on public.subscription_occurrences (subscription_id, occurrence_date desc);

alter table public.subscription_occurrences enable row level security;
create policy "subscription_occurrences_select_own" on public.subscription_occurrences
  for select using (auth.uid() = user_id);

drop trigger if exists subscription_occurrences_updated_at on public.subscription_occurrences;
create trigger subscription_occurrences_updated_at before update on public.subscription_occurrences
for each row execute function public.set_updated_at();

-- Safe backfill: only expenses with the explicit subscription generator and a
-- non-null subscription/date are accepted. No balance-affecting table changes
-- occur here, and ambiguous category-only expenses are intentionally skipped.
insert into public.subscription_occurrences (
  user_id, subscription_id, occurrence_date, amount, wallet_id, status,
  recurrence_key, generated_expense_id, created_at, updated_at
)
select e.user_id, e.subscription_id, e.occurrence_date, e.amount, e.wallet_id,
       'processed', coalesce(nullif(e.recurrence_key, ''), e.subscription_id::text || ':' || e.occurrence_date::text || ':' || coalesce(e.billing_cycle, 'monthly')),
       e.id, e.created_at, coalesce(e.updated_at, e.created_at)
from public.expenses e
join public.subscriptions s on s.id = e.subscription_id and s.user_id = e.user_id
where e.generated_by = 'subscription'
  and e.subscription_id is not null
  and e.occurrence_date is not null
  and e.deleted_at is null
on conflict (subscription_id, occurrence_date) do update
set generated_expense_id = coalesce(public.subscription_occurrences.generated_expense_id, excluded.generated_expense_id),
    status = 'processed', updated_at = now();

create or replace function public.subscription_add_cycle(anchor date, cycle text)
returns date language plpgsql immutable as $$
declare months integer; target date; last_day integer;
begin
  if cycle = 'weekly' then return anchor + 7; end if;
  months := case cycle when 'quarterly' then 3 when 'yearly' then 12 else 1 end;
  target := (date_trunc('month', anchor)::date + (months || ' months')::interval)::date;
  last_day := extract(day from (date_trunc('month', target) + interval '1 month - 1 day'))::integer;
  return target + least(extract(day from anchor)::integer, last_day) - 1;
end $$;

create or replace function public.reconcile_subscription_occurrences(
  target_user_id uuid default null,
  target_from date default null,
  target_through date default null
) returns table(created integer, linked integer, skipped integer, failed integer)
language plpgsql security definer set search_path = public as $$
declare s record; v_from date; v_through date; v_expense_id uuid;
begin
  if target_user_id is null and auth.role() <> 'service_role' then target_user_id := auth.uid(); end if;
  if target_user_id is null then raise exception 'authentication required'; end if;
  if auth.role() <> 'service_role' and auth.uid() <> target_user_id then raise exception 'not authorized'; end if;
  v_from := coalesce(target_from, (timezone('Asia/Manila', now())::date - 7));
  v_through := coalesce(target_through, (timezone('Asia/Manila', now())::date + 3));
  created := 0; linked := 0; skipped := 0; failed := 0;
  for s in select * from public.subscriptions where user_id = target_user_id and auto_renew and deleted_at is null loop
    if s.renewal_date between v_from and v_through then
      begin
        insert into public.subscription_occurrences(user_id, subscription_id, occurrence_date, amount, wallet_id, recurrence_key)
        values (s.user_id, s.id, s.renewal_date, s.amount, s.wallet_id, s.id::text || ':' || s.renewal_date::text || ':' || s.billing_cycle)
        on conflict (subscription_id, occurrence_date) do nothing;
        if found then created := created + 1; else skipped := skipped + 1; end if;
        select id into v_expense_id from public.expenses where user_id = s.user_id and subscription_id = s.id and occurrence_date = s.renewal_date and billing_cycle = s.billing_cycle and deleted_at is null limit 1;
        if v_expense_id is not null then
          update public.subscription_occurrences set generated_expense_id = v_expense_id, status = 'processed' where subscription_id = s.id and occurrence_date = s.renewal_date and generated_expense_id is null;
          if found then linked := linked + 1; end if;
        end if;
      exception when others then failed := failed + 1; end;
    end if;
  end loop;
  return next;
end $$;

create or replace function public.process_subscription_billing_occurrences(
  target_user_id uuid default null,
  target_through date default null
) returns table(processed integer, occurrences_created integer, expenses_created integer, duplicates_skipped integer, failed integer)
language plpgsql security definer set search_path = public as $$
declare s record; v_date date; v_next date; v_occurrence_id uuid; v_expense_id uuid; v_new boolean;
begin
  if target_user_id is null and auth.role() <> 'service_role' then target_user_id := auth.uid(); end if;
  if target_user_id is null then raise exception 'authentication required'; end if;
  if auth.role() <> 'service_role' and auth.uid() <> target_user_id then raise exception 'not authorized'; end if;
  target_through := coalesce(target_through, timezone('Asia/Manila', now())::date);
  processed := 0; occurrences_created := 0; expenses_created := 0; duplicates_skipped := 0; failed := 0;
  for s in select * from public.subscriptions where user_id = target_user_id and auto_renew and deleted_at is null and renewal_date <= target_through for update loop
    begin
      v_date := s.renewal_date;
      while v_date <= target_through loop
        v_occurrence_id := null;
        insert into public.subscription_occurrences(user_id, subscription_id, occurrence_date, amount, wallet_id, recurrence_key)
        values (s.user_id, s.id, v_date, s.amount, s.wallet_id, s.id::text || ':' || v_date::text || ':' || s.billing_cycle)
        on conflict (subscription_id, occurrence_date) do nothing
        returning id into v_occurrence_id;
        if v_occurrence_id is null then
          select id into v_occurrence_id from public.subscription_occurrences where subscription_id = s.id and occurrence_date = v_date;
          duplicates_skipped := duplicates_skipped + 1;
        else occurrences_created := occurrences_created + 1; end if;
        insert into public.expenses(user_id, amount, category, merchant, date, payment_method, subscription_id, billing_cycle, occurrence_date, generated_by, recurrence_key, billing_status, generated_at, wallet_id, deleted_at)
        values (s.user_id, s.amount, 'Subscriptions', s.name || ' Subscription', v_date, 'other', s.id, s.billing_cycle, v_date, 'subscription', s.id::text || ':' || v_date::text || ':' || s.billing_cycle, 'generated', now(), s.wallet_id, null)
        on conflict (user_id, subscription_id, occurrence_date, billing_cycle) do nothing
        returning id into v_expense_id;
        v_new := found;
        if not v_new then
          select id into v_expense_id from public.expenses where user_id = s.user_id and subscription_id = s.id and occurrence_date = v_date and billing_cycle = s.billing_cycle and deleted_at is null limit 1;
          duplicates_skipped := duplicates_skipped + 1;
        else expenses_created := expenses_created + 1; end if;
        update public.subscription_occurrences set generated_expense_id = v_expense_id, status = 'processed' where id = v_occurrence_id;
        v_date := public.subscription_add_cycle(v_date, s.billing_cycle);
      end loop;
      update public.subscriptions set renewal_date = v_date where id = s.id and renewal_date = s.renewal_date;
      processed := processed + 1;
    exception when others then failed := failed + 1;
    end;
  end loop;
  return next;
end $$;

grant execute on function public.reconcile_subscription_occurrences(uuid, date, date) to authenticated, service_role;
grant execute on function public.process_subscription_billing_occurrences(uuid, date) to authenticated, service_role;
