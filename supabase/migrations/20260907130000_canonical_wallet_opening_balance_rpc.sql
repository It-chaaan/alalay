-- PostgREST cannot safely resolve the historical overloaded RPC because
-- several identities use defaults. Keep one explicit backend-facing identity.
create or replace function public.create_wallet_with_opening_balance_v2(
  wallet_name text,
  wallet_type text,
  wallet_key text,
  wallet_color text,
  wallet_icon text,
  opening_amount numeric,
  account_type_value text,
  credit_limit_value numeric,
  account_purpose_value text,
  earns_interest_value boolean,
  annual_interest_rate_value numeric,
  interest_credit_frequency_value text,
  wallet_currency text,
  wallet_last_four text,
  payment_due_date_value date,
  payment_wallet_id_value uuid,
  auto_record_payment_value boolean,
  payment_rule_value text,
  fixed_payment_amount_value numeric
)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  created_wallet public.wallets;
begin
  if owner_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;
  if opening_amount is null or opening_amount < 0 then
    raise exception 'Opening balance cannot be negative' using errcode = '22023';
  end if;
  if account_type_value is not null and account_type_value not in ('debit', 'credit') then
    raise exception 'Invalid account type' using errcode = '22023';
  end if;
  if wallet_type not in ('bank', 'digital_bank') and account_type_value is not null then
    raise exception 'This institution does not support Debit or Credit classification' using errcode = 'P0001';
  end if;
  if account_type_value = 'credit' and account_purpose_value is not null then
    raise exception 'Credit accounts cannot have an account purpose' using errcode = 'P0001';
  end if;
  if account_type_value = 'credit'
    and (coalesce(earns_interest_value, false) or annual_interest_rate_value is not null or interest_credit_frequency_value is not null) then
    raise exception 'Savings interest settings require a debit savings account' using errcode = 'P0001';
  end if;
  if account_purpose_value is distinct from 'savings'
    and (coalesce(earns_interest_value, false) or annual_interest_rate_value is not null or interest_credit_frequency_value is not null) then
    raise exception 'Interest settings require a savings account' using errcode = 'P0001';
  end if;
  if annual_interest_rate_value is not null and annual_interest_rate_value < 0 then
    raise exception 'Annual interest rate cannot be negative' using errcode = '22023';
  end if;
  if credit_limit_value is not null
    and (account_type_value <> 'credit' or credit_limit_value < opening_amount) then
    raise exception 'Invalid credit limit' using errcode = 'P0001';
  end if;
  if account_type_value = 'credit' then
    if payment_due_date_value is null or payment_wallet_id_value is null then
      raise exception 'Payment due date and payment wallet are required for Credit accounts' using errcode = 'P0001';
    end if;
  elsif payment_due_date_value is not null or payment_wallet_id_value is not null
    or coalesce(auto_record_payment_value, false) or payment_rule_value is not null
    or fixed_payment_amount_value is not null then
    raise exception 'Credit payment settings are only available for Credit accounts' using errcode = 'P0001';
  end if;

  insert into public.wallets (
    user_id, name, institution_type, institution_key, color, icon,
    account_type, credit_limit, account_purpose, earns_interest,
    annual_interest_rate, interest_credit_frequency, currency, last_four,
    payment_due_date, payment_due_day, payment_wallet_id, auto_record_payment,
    payment_rule, fixed_payment_amount, is_default_cash
  ) values (
    owner_id, trim(wallet_name), wallet_type, trim(wallet_key),
    coalesce(wallet_color, '#0F8A6B'), wallet_icon, account_type_value,
    credit_limit_value, account_purpose_value, coalesce(earns_interest_value, false),
    annual_interest_rate_value, interest_credit_frequency_value,
    coalesce(wallet_currency, 'PHP'), wallet_last_four, payment_due_date_value,
    case when payment_due_date_value is null then null else extract(day from payment_due_date_value)::smallint end,
    payment_wallet_id_value, coalesce(auto_record_payment_value, false),
    case when coalesce(auto_record_payment_value, false) then payment_rule_value else null end,
    case when coalesce(auto_record_payment_value, false) and payment_rule_value = 'fixed_amount' then fixed_payment_amount_value else null end,
    false
  ) returning * into created_wallet;

  if opening_amount > 0 then
    insert into public.wallet_adjustments (user_id, wallet_id, amount, date, note)
    values (
      owner_id, created_wallet.id, opening_amount, (now() at time zone 'Asia/Manila')::date,
      case when account_type_value = 'credit' then 'Opening outstanding balance' else 'Opening balance' end
    );
  end if;

  select * into created_wallet from public.wallets where id = created_wallet.id;
  return created_wallet;
end;
$$;

revoke all on function public.create_wallet_with_opening_balance_v2(
  text, text, text, text, text, numeric, text, numeric, text, boolean,
  numeric, text, text, text, date, uuid, boolean, text, numeric
) from public;
grant execute on function public.create_wallet_with_opening_balance_v2(
  text, text, text, text, text, numeric, text, numeric, text, boolean,
  numeric, text, text, text, date, uuid, boolean, text, numeric
) to authenticated;

-- Remove the ambiguous historical identities by exact identity signature.
drop function if exists public.create_wallet_with_opening_balance(text, text, text, text, text, numeric, text, numeric, text, boolean, numeric, text, text, text, date, uuid, boolean, text, numeric);
drop function if exists public.create_wallet_with_opening_balance(text, text, text, text, text, numeric, text, numeric, text, boolean, numeric, text, text, text);
drop function if exists public.create_wallet_with_opening_balance(text, text, text, text, text, numeric, text, numeric, text, boolean, numeric, text);
drop function if exists public.create_wallet_with_opening_balance(text, text, text, text, text, numeric, text, numeric);
drop function if exists public.create_wallet_with_opening_balance(text, text, text, text, text, numeric);

notify pgrst, 'reload schema';
