-- Additive account architecture. Legacy wallets remain intact and continue to
-- serve existing APIs while new account/pocket/card workflows are introduced.
-- No records are merged: ambiguous historical wallets get their own account.

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  institution_type text not null default 'cash',
  institution_key text not null default 'cash',
  name text not null,
  account_type text not null default 'cash',
  currency text not null default 'PHP',
  opening_balance numeric not null default 0,
  status text not null default 'active',
  include_in_total_balance boolean not null default true,
  last_four text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_accounts_type_check check (account_type in ('cash', 'bank', 'digital_bank', 'e_wallet', 'credit')),
  constraint financial_accounts_status_check check (status in ('active', 'frozen', 'closed')),
  constraint financial_accounts_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint financial_accounts_last_four_check check (last_four is null or last_four ~ '^[0-9]{4}$')
);

create table if not exists public.balance_pockets (
  id uuid primary key default gen_random_uuid(),
  financial_account_id uuid not null references public.financial_accounts(id) on delete cascade,
  pocket_type text not null,
  balance numeric not null default 0,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint balance_pockets_type_check check (pocket_type in ('available', 'savings', 'reserved')),
  constraint balance_pockets_balance_check check (balance >= 0),
  unique (financial_account_id, pocket_type)
);

create table if not exists public.card_instruments (
  id uuid primary key default gen_random_uuid(),
  financial_account_id uuid not null references public.financial_accounts(id) on delete cascade,
  network text not null default 'none',
  card_type text not null,
  last_four text,
  nickname text,
  physical_or_virtual text not null default 'physical',
  expiration_month smallint,
  expiration_year smallint,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_instruments_network_check check (network in ('visa', 'mastercard', 'jcb', 'unionpay', 'amex', 'other', 'none')),
  constraint card_instruments_type_check check (card_type in ('debit', 'prepaid', 'virtual_debit', 'virtual_prepaid')),
  constraint card_instruments_last_four_check check (last_four is null or last_four ~ '^[0-9]{4}$'),
  constraint card_instruments_form_check check (physical_or_virtual in ('physical', 'virtual')),
  constraint card_instruments_status_check check (status in ('active', 'frozen', 'expired')),
  constraint card_instruments_month_check check (expiration_month is null or expiration_month between 1 and 12)
);

create table if not exists public.payment_instructions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  credit_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  billing_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  amount numeric,
  amount_preference text not null default 'user_chooses',
  scheduled_date date not null,
  status text not null default 'scheduled',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_instructions_amount_check check (amount is null or amount > 0),
  constraint payment_instructions_preference_check check (amount_preference in ('full_statement', 'minimum_due', 'fixed_amount', 'user_chooses')),
  constraint payment_instructions_status_check check (status in ('scheduled', 'pending_confirmation', 'completed', 'failed', 'cancelled', 'reversed')),
  constraint payment_instructions_different_accounts check (credit_account_id <> billing_account_id)
);

alter table public.wallets
  add column if not exists financial_account_id uuid references public.financial_accounts(id) on delete restrict,
  add column if not exists include_in_total_balance boolean not null default true;

alter table public.financial_accounts enable row level security;
alter table public.balance_pockets enable row level security;
alter table public.card_instruments enable row level security;
alter table public.payment_instructions enable row level security;

create policy financial_accounts_select_own on public.financial_accounts for select using (auth.uid() = user_id);
create policy financial_accounts_insert_own on public.financial_accounts for insert with check (auth.uid() = user_id);
create policy financial_accounts_update_own on public.financial_accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy balance_pockets_select_own on public.balance_pockets for select using (exists (select 1 from public.financial_accounts a where a.id = financial_account_id and a.user_id = auth.uid()));
create policy balance_pockets_insert_own on public.balance_pockets for insert with check (exists (select 1 from public.financial_accounts a where a.id = financial_account_id and a.user_id = auth.uid()));
create policy balance_pockets_update_own on public.balance_pockets for update using (exists (select 1 from public.financial_accounts a where a.id = financial_account_id and a.user_id = auth.uid())) with check (exists (select 1 from public.financial_accounts a where a.id = financial_account_id and a.user_id = auth.uid()));
create policy card_instruments_select_own on public.card_instruments for select using (exists (select 1 from public.financial_accounts a where a.id = financial_account_id and a.user_id = auth.uid()));
create policy card_instruments_insert_own on public.card_instruments for insert with check (exists (select 1 from public.financial_accounts a where a.id = financial_account_id and a.user_id = auth.uid()));
create policy card_instruments_update_own on public.card_instruments for update using (exists (select 1 from public.financial_accounts a where a.id = financial_account_id and a.user_id = auth.uid())) with check (exists (select 1 from public.financial_accounts a where a.id = financial_account_id and a.user_id = auth.uid()));
create policy payment_instructions_select_own on public.payment_instructions for select using (auth.uid() = user_id);
create policy payment_instructions_insert_own on public.payment_instructions for insert with check (auth.uid() = user_id);
create policy payment_instructions_update_own on public.payment_instructions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists financial_accounts_user_idx on public.financial_accounts(user_id, created_at);
create index if not exists balance_pockets_account_idx on public.balance_pockets(financial_account_id);
create index if not exists card_instruments_account_idx on public.card_instruments(financial_account_id);
create index if not exists payment_instructions_user_date_idx on public.payment_instructions(user_id, scheduled_date);

-- Conservative backfill: one account per existing wallet avoids silently
-- merging similarly named or potentially unrelated real-world accounts.
do $$
declare
  wallet_row record;
  account_id uuid;
  account_kind text;
begin
  for wallet_row in
    select * from public.wallets where financial_account_id is null
  loop
    account_kind := case
      when wallet_row.account_type = 'credit' then 'credit'
      when wallet_row.institution_type = 'cash' or wallet_row.is_default_cash then 'cash'
      when wallet_row.institution_type = 'digital_bank' then 'digital_bank'
      when wallet_row.institution_type = 'e_wallet' then 'e_wallet'
      else 'bank'
    end;
    insert into public.financial_accounts (
      user_id, institution_type, institution_key, name, account_type,
      currency, opening_balance, include_in_total_balance, last_four
    ) values (
      wallet_row.user_id, wallet_row.institution_type, wallet_row.institution_key,
      wallet_row.name, account_kind, coalesce(wallet_row.currency, 'PHP'),
      case when wallet_row.account_type = 'credit' then 0 else coalesce(wallet_row.balance, 0) end,
      coalesce(wallet_row.include_in_total_balance, true), wallet_row.last_four
    ) returning id into account_id;
    update public.wallets set financial_account_id = account_id where id = wallet_row.id;
    insert into public.balance_pockets (financial_account_id, pocket_type, balance)
    values (account_id, case when wallet_row.account_purpose = 'savings' then 'savings' else 'available' end, greatest(coalesce(wallet_row.balance, 0), 0));
  end loop;
end;
$$;

comment on table public.financial_accounts is 'Canonical account identity; wallets are retained as a backward-compatible legacy ledger reference.';
comment on table public.balance_pockets is 'Account-owned available, savings, and reserved balances; pocket moves are internal allocations.';
comment on table public.card_instruments is 'Debit/prepaid access instruments linked to an account; never a separate cash balance.';
comment on table public.payment_instructions is 'Tracking-only scheduled card payments until the user confirms an external payment.';
