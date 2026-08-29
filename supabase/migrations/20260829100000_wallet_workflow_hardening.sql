-- Wallet workflow hardening. Existing wallet IDs and ledger rows are preserved.
-- Legacy rows remain nullable/classification-safe; ambiguous wallets are treated
-- as asset wallets until the owner explicitly classifies them.
alter table public.wallets
  add column if not exists currency text not null default 'PHP',
  add column if not exists last_four text;

alter table public.wallets
  drop constraint if exists wallets_currency_check,
  add constraint wallets_currency_check check (currency ~ '^[A-Z]{3}$'),
  drop constraint if exists wallets_last_four_check,
  add constraint wallets_last_four_check check (last_four is null or last_four ~ '^[0-9]{4}$');

create or replace function public.validate_wallet_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.wallet_id is not null and not exists (
    select 1 from public.wallets w
    where w.id = new.wallet_id and w.user_id = new.user_id
  ) then
    raise exception 'wallet does not belong to transaction owner';
  end if;

  if tg_table_name = 'income' and new.wallet_id is not null and exists (
    select 1 from public.wallets w
    where w.id = new.wallet_id and w.user_id = new.user_id and w.account_type = 'credit'
  ) then
    raise exception 'Credit cards cannot receive income';
  end if;
  return new;
end;
$$;

drop trigger if exists income_wallet_owner_check on public.income;
create trigger income_wallet_owner_check
before insert or update on public.income
for each row execute function public.validate_wallet_workflow();

drop trigger if exists expenses_wallet_owner_check on public.expenses;
create trigger expenses_wallet_owner_check
before insert or update on public.expenses
for each row execute function public.validate_wallet_workflow();

drop trigger if exists bills_wallet_owner_check on public.bills;
create trigger bills_wallet_owner_check
before insert or update on public.bills
for each row execute function public.validate_wallet_workflow();

drop trigger if exists subscriptions_wallet_owner_check on public.subscriptions;
create trigger subscriptions_wallet_owner_check
before insert or update on public.subscriptions
for each row execute function public.validate_wallet_workflow();

revoke all on function public.validate_wallet_workflow() from public;
grant execute on function public.validate_wallet_workflow() to authenticated;

-- Keep the existing opening-balance RPC contract working while allowing new
-- clients to persist account currency and masked card identity metadata.
create or replace function public.create_wallet_with_opening_balance(
  wallet_name text,
  wallet_type text,
  wallet_key text,
  wallet_color text,
  wallet_icon text,
  opening_amount numeric,
  account_type_value text default null,
  credit_limit_value numeric default null,
  account_purpose_value text default null,
  earns_interest_value boolean default false,
  annual_interest_rate_value numeric default null,
  interest_credit_frequency_value text default null,
  wallet_currency text default 'PHP',
  wallet_last_four text default null
)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  created_wallet public.wallets;
begin
  select * into created_wallet from public.create_wallet_with_opening_balance(
    wallet_name, wallet_type, wallet_key, wallet_color, wallet_icon,
    opening_amount, account_type_value, credit_limit_value,
    account_purpose_value, earns_interest_value, annual_interest_rate_value,
    interest_credit_frequency_value
  );
  update public.wallets
  set currency = coalesce(wallet_currency, 'PHP'), last_four = wallet_last_four
  where id = created_wallet.id
  returning * into created_wallet;
  return created_wallet;
end;
$$;

revoke all on function public.create_wallet_with_opening_balance(text, text, text, text, text, numeric, text, numeric, text, boolean, numeric, text, text, text) from public;
grant execute on function public.create_wallet_with_opening_balance(text, text, text, text, text, numeric, text, numeric, text, boolean, numeric, text, text, text) to authenticated;
