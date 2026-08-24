-- Wallet purpose and savings-interest metadata are descriptive only. They never
-- create income or change balances until an actual interest transaction exists.
alter table public.wallets
  add column if not exists account_purpose text,
  add column if not exists earns_interest boolean not null default false,
  add column if not exists annual_interest_rate numeric(8,4),
  add column if not exists interest_credit_frequency text;

update public.wallets
set account_purpose = 'everyday'
where account_type = 'debit' and account_purpose is null;

update public.wallets
set annual_interest_rate = interest_rate
where annual_interest_rate is null and interest_rate is not null;

alter table public.wallets
  drop constraint if exists wallets_account_purpose_check,
  add constraint wallets_account_purpose_check
    check (account_purpose is null or account_purpose in ('everyday', 'savings')),
  drop constraint if exists wallets_annual_interest_rate_check,
  add constraint wallets_annual_interest_rate_check
    check (annual_interest_rate is null or annual_interest_rate >= 0),
  drop constraint if exists wallets_interest_credit_frequency_check,
  add constraint wallets_interest_credit_frequency_check
    check (interest_credit_frequency is null or interest_credit_frequency in ('monthly', 'quarterly', 'semi_annually', 'annually', 'unspecified'));

alter table public.wallets
  drop constraint if exists wallets_savings_metadata_check,
  add constraint wallets_savings_metadata_check check (
    (account_type = 'credit' and account_purpose is null and earns_interest = false and annual_interest_rate is null and interest_credit_frequency is null)
    or
    (account_type is distinct from 'credit' and (account_purpose is null or account_purpose in ('everyday', 'savings')))
  );

drop function if exists public.create_wallet_with_opening_balance(text, text, text, text, text, numeric, text, numeric);

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
  interest_credit_frequency_value text default null
)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  created_wallet public.wallets;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if opening_amount < 0 then raise exception 'Opening balance cannot be negative'; end if;
  if account_type_value is not null and account_type_value not in ('debit', 'credit') then raise exception 'Invalid account type'; end if;
  if wallet_type not in ('bank', 'digital_bank', 'e_wallet') and account_type_value is not null then raise exception 'This institution does not support Debit or Credit classification'; end if;
  if account_type_value = 'credit' and account_purpose_value is not null then raise exception 'Credit accounts cannot have an account purpose'; end if;
  if account_type_value = 'credit' and (earns_interest_value or annual_interest_rate_value is not null or interest_credit_frequency_value is not null) then raise exception 'Savings interest settings require a debit savings account'; end if;
  if account_purpose_value is distinct from 'savings' and (earns_interest_value or annual_interest_rate_value is not null or interest_credit_frequency_value is not null) then raise exception 'Interest settings require a savings account'; end if;
  if annual_interest_rate_value is not null and annual_interest_rate_value < 0 then raise exception 'Annual interest rate cannot be negative'; end if;
  if credit_limit_value is not null and (account_type_value <> 'credit' or credit_limit_value < opening_amount) then raise exception 'Invalid credit limit'; end if;

  insert into public.wallets (user_id, name, institution_type, institution_key, color, icon, account_type, credit_limit, account_purpose, earns_interest, annual_interest_rate, interest_credit_frequency, is_default_cash)
  values (auth.uid(), trim(wallet_name), wallet_type, trim(wallet_key), coalesce(wallet_color, '#0F8A6B'), wallet_icon, account_type_value, credit_limit_value, account_purpose_value, earns_interest_value, annual_interest_rate_value, interest_credit_frequency_value, false)
  returning * into created_wallet;

  if opening_amount > 0 then
    insert into public.wallet_adjustments (user_id, wallet_id, amount, date, note)
    values (auth.uid(), created_wallet.id, opening_amount, current_date, case when account_type_value = 'credit' then 'Opening outstanding balance' else 'Opening balance' end);
  end if;
  select * into created_wallet from public.wallets where id = created_wallet.id;
  return created_wallet;
end;
$$;

revoke all on function public.create_wallet_with_opening_balance(text, text, text, text, text, numeric, text, numeric, text, boolean, numeric, text) from public;
grant execute on function public.create_wallet_with_opening_balance(text, text, text, text, text, numeric, text, numeric, text, boolean, numeric, text) to authenticated;
