-- Credit-card finance charges are liabilities.  They deliberately do not use
-- the savings-interest tables/RPCs, which create income in an asset wallet.
-- Existing cards remain estimate-only; this migration never creates history.
alter table public.wallets
  add column if not exists credit_interest_tracking_mode text not null default 'estimate_only',
  add column if not exists credit_interest_rate numeric,
  add column if not exists credit_interest_rate_basis text;

alter table public.wallets drop constraint if exists wallets_credit_interest_tracking_mode_check;
alter table public.wallets add constraint wallets_credit_interest_tracking_mode_check
  check (credit_interest_tracking_mode in ('estimate_only', 'manual_confirm'));
alter table public.wallets drop constraint if exists wallets_credit_interest_rate_basis_check;
alter table public.wallets add constraint wallets_credit_interest_rate_basis_check
  check (credit_interest_rate_basis is null or credit_interest_rate_basis in ('annual', 'monthly'));
alter table public.wallets drop constraint if exists wallets_credit_interest_settings_check;
alter table public.wallets add constraint wallets_credit_interest_settings_check
  check (
    (account_type = 'credit')
    or (credit_interest_tracking_mode = 'estimate_only' and credit_interest_rate is null and credit_interest_rate_basis is null)
  );

create table if not exists public.credit_card_rate_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  credit_wallet_id uuid not null references public.wallets(id) on delete restrict,
  effective_on date not null,
  rate numeric not null check (rate >= 0 and rate <= 100),
  rate_basis text not null check (rate_basis in ('annual', 'monthly')),
  created_at timestamptz not null default now(),
  unique (credit_wallet_id, effective_on)
);

create table if not exists public.credit_card_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  credit_wallet_id uuid not null references public.wallets(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  closing_date date not null,
  due_date date not null,
  opening_balance numeric not null default 0,
  purchases_amount numeric not null default 0,
  payments_credits_amount numeric not null default 0,
  fees_amount numeric not null default 0,
  confirmed_finance_charges_amount numeric not null default 0,
  statement_balance numeric not null check (statement_balance >= 0),
  minimum_due numeric not null default 0 check (minimum_due >= 0),
  amount_paid numeric not null default 0 check (amount_paid >= 0),
  remaining_balance numeric not null check (remaining_balance >= 0),
  status text not null default 'issued' check (status in ('open', 'issued', 'partially_paid', 'paid', 'past_due')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (closing_date >= period_end),
  check (due_date > closing_date),
  check (minimum_due <= statement_balance),
  check (amount_paid <= statement_balance),
  unique (credit_wallet_id, period_start, period_end)
);
create index if not exists credit_card_statements_wallet_due_idx on public.credit_card_statements (credit_wallet_id, due_date desc);

create table if not exists public.credit_card_finance_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  credit_wallet_id uuid not null references public.wallets(id) on delete restrict,
  statement_id uuid not null references public.credit_card_statements(id) on delete restrict,
  expense_id uuid not null references public.expenses(id) on delete restrict,
  charge_type text not null default 'finance_charge' check (charge_type in ('finance_charge', 'late_fee')),
  amount numeric not null check (amount > 0),
  charged_on date not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (credit_wallet_id, statement_id, charge_type),
  unique (expense_id)
);
alter table public.expenses add column if not exists credit_card_finance_charge_id uuid;
alter table public.expenses drop constraint if exists expenses_credit_card_finance_charge_id_fkey;
alter table public.expenses add constraint expenses_credit_card_finance_charge_id_fkey
  foreign key (credit_card_finance_charge_id) references public.credit_card_finance_charges(id) on delete restrict;
create unique index if not exists expenses_credit_card_finance_charge_idx
  on public.expenses(credit_card_finance_charge_id) where credit_card_finance_charge_id is not null;

alter table public.credit_card_rate_history enable row level security;
alter table public.credit_card_statements enable row level security;
alter table public.credit_card_finance_charges enable row level security;
create policy credit_card_rate_history_select_own on public.credit_card_rate_history for select using (auth.uid() = user_id);
create policy credit_card_statements_select_own on public.credit_card_statements for select using (auth.uid() = user_id);
create policy credit_card_finance_charges_select_own on public.credit_card_finance_charges for select using (auth.uid() = user_id);
revoke all on public.credit_card_rate_history, public.credit_card_statements, public.credit_card_finance_charges from public;
grant select on public.credit_card_rate_history, public.credit_card_statements, public.credit_card_finance_charges to authenticated;

-- Simple, explicitly non-bank-authoritative estimate. Statement creation is
-- manual for now, so no scheduler can fabricate statements or post charges.
create or replace function public.credit_card_interest_estimate(target_wallet_id uuid, estimate_on date default (now() at time zone 'Asia/Manila')::date)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare owner_id uuid := auth.uid(); w public.wallets; s public.credit_card_statements; r public.credit_card_rate_history; periodic_rate numeric; estimate numeric;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  select * into w from public.wallets where id = target_wallet_id and user_id = owner_id and account_type = 'credit';
  if not found then raise exception 'Credit card not found'; end if;
  select * into s from public.credit_card_statements where credit_wallet_id = w.id and user_id = owner_id and status in ('issued', 'partially_paid', 'past_due') order by closing_date desc limit 1;
  if not found or coalesce(w.credit_interest_rate, 0) <= 0 then
    return jsonb_build_object('enabled', false, 'tracking_mode', w.credit_interest_tracking_mode, 'is_estimate', true);
  end if;
  select * into r from public.credit_card_rate_history where credit_wallet_id = w.id and user_id = owner_id and effective_on <= s.closing_date order by effective_on desc limit 1;
  periodic_rate := coalesce(r.rate, w.credit_interest_rate) / 100 / case when coalesce(r.rate_basis, w.credit_interest_rate_basis) = 'annual' then 12 else 1 end;
  estimate := round(s.remaining_balance * periodic_rate, 2);
  return jsonb_build_object('enabled', true, 'tracking_mode', w.credit_interest_tracking_mode, 'calculation_method', 'simple_statement_balance_estimate', 'rate', coalesce(r.rate, w.credit_interest_rate), 'rate_basis', coalesce(r.rate_basis, w.credit_interest_rate_basis), 'statement_id', s.id, 'eligible_unpaid_balance', s.remaining_balance, 'estimated_finance_charge', estimate, 'is_estimate', true);
end; $$;

create or replace function public.record_credit_card_finance_charge(target_credit_wallet_id uuid, statement_id_value uuid, charge_amount numeric, charged_on_value date, charge_type_value text, request_key text)
returns public.credit_card_finance_charges language plpgsql security definer set search_path = pg_catalog, public as $$
declare owner_id uuid := auth.uid(); w public.wallets; s public.credit_card_statements; result public.credit_card_finance_charges; expense_row public.expenses;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if charge_amount is null or charge_amount <= 0 or charge_amount <> trunc(charge_amount, 2) then raise exception 'Charge amount must be a positive currency amount'; end if;
  if charge_type_value not in ('finance_charge', 'late_fee') then raise exception 'Invalid credit-card charge type'; end if;
  if request_key is null or length(trim(request_key)) < 16 then raise exception 'Idempotency key is required'; end if;
  select * into result from public.credit_card_finance_charges where user_id = owner_id and idempotency_key = trim(request_key);
  if found then return result; end if;
  select * into w from public.wallets where id = target_credit_wallet_id and user_id = owner_id and account_type = 'credit' for update;
  if not found then raise exception 'Credit card not found'; end if;
  if w.credit_interest_tracking_mode <> 'manual_confirm' then raise exception 'Card is estimate-only; enable manual confirmation before recording a charge'; end if;
  select * into s from public.credit_card_statements where id = statement_id_value and credit_wallet_id = w.id and user_id = owner_id for update;
  if not found then raise exception 'Statement not found'; end if;
  insert into public.expenses(user_id, wallet_id, amount, category, merchant, date, payment_method)
  values(owner_id, w.id, charge_amount, 'Debt / Loan', case when charge_type_value = 'late_fee' then 'Credit card late fee - ' else 'Credit card finance charge - ' end || w.name, charged_on_value, 'card') returning * into expense_row;
  insert into public.credit_card_finance_charges(user_id, credit_wallet_id, statement_id, expense_id, charge_type, amount, charged_on, idempotency_key)
  values(owner_id, w.id, s.id, expense_row.id, charge_type_value, charge_amount, charged_on_value, trim(request_key)) returning * into result;
  update public.expenses set credit_card_finance_charge_id = result.id where id = expense_row.id;
  update public.credit_card_statements set confirmed_finance_charges_amount = confirmed_finance_charges_amount + case when charge_type_value = 'finance_charge' then charge_amount else 0 end, fees_amount = fees_amount + case when charge_type_value = 'late_fee' then charge_amount else 0 end, updated_at = now() where id = s.id;
  perform public.recompute_wallet_balance(w.id);
  return result;
end; $$;

-- Defend the old asset-interest RPC even when invoked directly through PostgREST.
create or replace function public.post_wallet_interest(target_wallet_id uuid, received_amount numeric, credited_on_value date, note_value text, request_key text)
returns public.income language plpgsql security definer set search_path = pg_catalog, public as $$
declare owner_id uuid := auth.uid(); w public.wallets; result public.income;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if received_amount <= 0 or received_amount <> pg_catalog.trunc(received_amount, 2) then raise exception 'Interest amount must be a positive currency amount'; end if;
  if request_key is null or length(trim(request_key)) < 8 then raise exception 'Idempotency key is required'; end if;
  select i.* into result from public.wallet_interest_confirmations c join public.income i on i.id = c.income_id where c.user_id = owner_id and c.idempotency_key = trim(request_key);
  if found then return result; end if;
  select * into w from public.wallets where id = target_wallet_id and user_id = owner_id and account_type = 'debit' and account_purpose = 'savings' and earns_interest = true for update;
  if not found then raise exception 'Savings wallet with interest enabled not found'; end if;
  insert into public.income(user_id, wallet_id, source, type, amount, date, is_recurring) values(owner_id, w.id, coalesce(nullif(trim(note_value), ''), w.name || ' interest'), 'interest', received_amount, credited_on_value, false) returning * into result;
  insert into public.wallet_interest_confirmations(user_id, wallet_id, income_id, credited_on, idempotency_key) values(owner_id, w.id, result.id, credited_on_value, trim(request_key));
  return result;
end; $$;

revoke all on function public.credit_card_interest_estimate(uuid, date) from public;
grant execute on function public.credit_card_interest_estimate(uuid, date) to authenticated;
revoke all on function public.record_credit_card_finance_charge(uuid, uuid, numeric, date, text, text) from public;
grant execute on function public.record_credit_card_finance_charge(uuid, uuid, numeric, date, text, text) to authenticated;
notify pgrst, 'reload schema';
