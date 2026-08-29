-- Credit-card payment settings are tracking metadata only. They never initiate
-- a real bank payment and remain nullable for credit cards created before this
-- migration.
alter table public.wallets
  add column if not exists payment_due_date date,
  add column if not exists payment_due_day smallint,
  add column if not exists payment_wallet_id uuid references public.wallets(id) on delete set null,
  add column if not exists auto_record_payment boolean not null default false,
  add column if not exists payment_rule text,
  add column if not exists fixed_payment_amount numeric,
  add column if not exists is_active boolean not null default true;

alter table public.wallets
  drop constraint if exists wallets_payment_due_day_check,
  add constraint wallets_payment_due_day_check check (payment_due_day is null or payment_due_day between 1 and 31),
  drop constraint if exists wallets_payment_rule_check,
  add constraint wallets_payment_rule_check check (payment_rule is null or payment_rule in ('full_outstanding', 'fixed_amount', 'minimum_due')),
  drop constraint if exists wallets_fixed_payment_amount_check,
  add constraint wallets_fixed_payment_amount_check check (fixed_payment_amount is null or fixed_payment_amount > 0);

create index if not exists wallets_payment_wallet_idx on public.wallets(payment_wallet_id)
where payment_wallet_id is not null;

create or replace function public.validate_credit_card_payment_setup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_type is distinct from 'credit' then
    if new.payment_due_date is not null or new.payment_due_day is not null
      or new.payment_wallet_id is not null or new.auto_record_payment
      or new.payment_rule is not null or new.fixed_payment_amount is not null then
      raise exception 'Credit payment settings are only available for Credit accounts';
    end if;
    return new;
  end if;

  if new.payment_wallet_id is not null and not exists (
    select 1 from public.wallets payment_wallet
    where payment_wallet.id = new.payment_wallet_id
      and payment_wallet.user_id = new.user_id
      and payment_wallet.account_type is distinct from 'credit'
      and payment_wallet.is_active
      and payment_wallet.id <> new.id
  ) then
    raise exception 'payment wallet is not available';
  end if;

  if new.fixed_payment_amount is not null and new.payment_rule is distinct from 'fixed_amount' then
    raise exception 'fixed payment amount requires the fixed amount rule';
  end if;
  if new.payment_rule = 'fixed_amount' and coalesce(new.fixed_payment_amount, 0) <= 0 then
    raise exception 'fixed payment amount must be greater than zero';
  end if;
  if new.auto_record_payment and (new.payment_due_date is null or new.payment_wallet_id is null or new.payment_rule is null) then
    raise exception 'automatic payment tracking requires a due date, payment wallet, and payment rule';
  end if;
  return new;
end;
$$;

drop trigger if exists wallets_validate_credit_card_payment_setup on public.wallets;
create trigger wallets_validate_credit_card_payment_setup
before insert or update on public.wallets
for each row execute function public.validate_credit_card_payment_setup();

-- Keep the prior RPC signature working for old clients and add a complete
-- signature for clients that configure a new credit card.
create or replace function public.create_wallet_with_opening_balance(
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
  created_wallet public.wallets;
begin
  if account_type_value = 'credit' then
    if payment_due_date_value is null then raise exception 'Payment due date is required for Credit accounts'; end if;
    if payment_wallet_id_value is null then raise exception 'Payment wallet is required for Credit accounts'; end if;
  elsif payment_due_date_value is not null or payment_wallet_id_value is not null
    or coalesce(auto_record_payment_value, false) or payment_rule_value is not null
    or fixed_payment_amount_value is not null then
    raise exception 'Credit payment settings are only available for Credit accounts';
  end if;

  select * into created_wallet from public.create_wallet_with_opening_balance(
    wallet_name, wallet_type, wallet_key, wallet_color, wallet_icon,
    opening_amount, account_type_value, credit_limit_value,
    account_purpose_value, earns_interest_value, annual_interest_rate_value,
    interest_credit_frequency_value, wallet_currency, wallet_last_four
  );

  update public.wallets
  set payment_due_date = payment_due_date_value,
      payment_due_day = case when payment_due_date_value is null then null else extract(day from payment_due_date_value)::smallint end,
      payment_wallet_id = payment_wallet_id_value,
      auto_record_payment = coalesce(auto_record_payment_value, false),
      payment_rule = case when coalesce(auto_record_payment_value, false) then payment_rule_value else null end,
      fixed_payment_amount = case when coalesce(auto_record_payment_value, false) and payment_rule_value = 'fixed_amount' then fixed_payment_amount_value else null end
  where id = created_wallet.id
  returning * into created_wallet;
  return created_wallet;
end;
$$;

revoke all on function public.create_wallet_with_opening_balance(text, text, text, text, text, numeric, text, numeric, text, boolean, numeric, text, text, text, date, uuid, boolean, text, numeric) from public;
grant execute on function public.create_wallet_with_opening_balance(text, text, text, text, text, numeric, text, numeric, text, boolean, numeric, text, text, text, date, uuid, boolean, text, numeric) to authenticated;
