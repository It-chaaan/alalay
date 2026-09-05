-- Phase 1: estimates are derived only. They never change confirmed balances.
alter table public.wallets add column if not exists interest_effective_date date;
update public.wallets
set interest_effective_date = created_at::date
where earns_interest = true and interest_effective_date is null;

create table if not exists public.wallet_interest_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  income_id uuid not null references public.income(id) on delete restrict,
  credited_on date not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key), unique (income_id)
);
alter table public.wallet_interest_confirmations enable row level security;
create policy wallet_interest_confirmations_select_own on public.wallet_interest_confirmations for select using (auth.uid() = user_id);

create or replace function public.wallet_interest_estimate(target_wallet_id uuid, estimate_on date default current_date)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare owner_id uuid := auth.uid(); w public.wallets; start_on date; confirmed_on date; eligible_days integer; eligible_balance numeric; daily numeric; accrued numeric;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  select * into w from public.wallets where id = target_wallet_id and user_id = owner_id;
  if not found then raise exception 'Wallet not found'; end if;
  if not coalesce(w.earns_interest, false) or w.account_purpose is distinct from 'savings'
    or coalesce(w.annual_interest_rate, 0) <= 0 then
    return jsonb_build_object('enabled', false, 'tracking_mode', 'estimate_only');
  end if;
  select max(c.credited_on) into confirmed_on from public.wallet_interest_confirmations c where c.wallet_id = w.id and c.user_id = owner_id;
  start_on := greatest(coalesce(w.interest_effective_date, w.created_at::date), coalesce(confirmed_on, w.interest_effective_date, w.created_at::date));
  if start_on > estimate_on then
    return jsonb_build_object('enabled', true, 'tracking_mode', 'estimate_only', 'annual_interest_rate', w.annual_interest_rate, 'period_start', start_on, 'period_end', estimate_on, 'eligible_days', 0, 'eligible_balance', greatest(w.balance, 0), 'estimated_daily_interest', 0, 'estimated_accrued_interest', 0, 'is_estimate', true);
  end if;
  eligible_days := greatest(0, estimate_on - start_on);
  eligible_balance := greatest(coalesce(w.balance, 0), 0);
  daily := eligible_balance * (w.annual_interest_rate / 100) / 365;
  accrued := daily * eligible_days;
  return jsonb_build_object('enabled', true, 'tracking_mode', 'estimate_only', 'calculation_method', 'simple_daily_estimate', 'day_count_basis', 365, 'annual_interest_rate', w.annual_interest_rate, 'period_start', start_on, 'period_end', estimate_on, 'eligible_days', eligible_days, 'eligible_balance', eligible_balance, 'estimated_daily_interest', daily, 'estimated_accrued_interest', accrued, 'is_estimate', true);
end; $$;

create or replace function public.post_wallet_interest(target_wallet_id uuid, received_amount numeric, credited_on_value date, note_value text, request_key text)
returns public.income language plpgsql security definer set search_path = pg_catalog, public as $$
declare owner_id uuid := auth.uid(); w public.wallets; result public.income;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if received_amount <= 0 or received_amount <> pg_catalog.trunc(received_amount, 2) then raise exception 'Interest amount must be a positive currency amount'; end if;
  if request_key is null or length(trim(request_key)) < 8 then raise exception 'Idempotency key is required'; end if;
  select i.* into result from public.wallet_interest_confirmations c join public.income i on i.id = c.income_id where c.user_id = owner_id and c.idempotency_key = request_key;
  if found then return result; end if;
  select * into w from public.wallets where id = target_wallet_id and user_id = owner_id for update;
  if not found then raise exception 'Wallet not found'; end if;
  insert into public.income(user_id, wallet_id, source, type, amount, date, is_recurring)
  values(owner_id, w.id, coalesce(nullif(trim(note_value), ''), w.name || ' interest'), 'interest', received_amount, credited_on_value, false)
  returning * into result;
  insert into public.wallet_interest_confirmations(user_id, wallet_id, income_id, credited_on, idempotency_key)
  values(owner_id, w.id, result.id, credited_on_value, trim(request_key));
  return result;
end; $$;
revoke all on function public.wallet_interest_estimate(uuid, date) from public;
grant execute on function public.wallet_interest_estimate(uuid, date) to authenticated;
revoke all on function public.post_wallet_interest(uuid, numeric, date, text, text) from public;
grant execute on function public.post_wallet_interest(uuid, numeric, date, text, text) to authenticated;
notify pgrst, 'reload schema';
