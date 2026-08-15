-- Debit accounts are assets; Credit accounts are liabilities. Nullable keeps
-- historical Cash and E-wallet records backward compatible.
alter table public.wallets add column if not exists account_type text;
alter table public.wallets add column if not exists credit_limit numeric;
alter table public.wallets add constraint wallets_account_type_check
  check (account_type is null or account_type in ('debit', 'credit'));
alter table public.wallets add constraint wallets_credit_limit_check
  check (credit_limit is null or credit_limit >= 0);

create or replace function public.create_wallet_with_opening_balance(
  wallet_name text,
  wallet_type text,
  wallet_key text,
  wallet_color text,
  wallet_icon text,
  opening_amount numeric,
  account_type_value text default null,
  credit_limit_value numeric default null
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
  if wallet_type not in ('bank', 'digital_bank') and account_type_value is not null then
    raise exception 'This institution does not support Debit or Credit classification';
  end if;
  if account_type_value not in ('debit', 'credit') and account_type_value is not null then
    raise exception 'Invalid account type';
  end if;
  if account_type_value <> 'credit' and credit_limit_value is not null then
    raise exception 'Credit limit is only available for Credit accounts';
  end if;
  if credit_limit_value is not null and opening_amount > credit_limit_value then
    raise exception 'Outstanding balance cannot be greater than the credit limit';
  end if;

  insert into public.wallets (user_id, name, institution_type, institution_key, color, icon, account_type, credit_limit, is_default_cash)
  values (auth.uid(), trim(wallet_name), wallet_type, trim(wallet_key), coalesce(wallet_color, '#0F8A6B'), wallet_icon, account_type_value, credit_limit_value, false)
  returning * into created_wallet;

  if opening_amount > 0 then
    insert into public.wallet_adjustments (user_id, wallet_id, amount, date, note)
    values (auth.uid(), created_wallet.id, opening_amount, current_date, case when account_type_value = 'credit' then 'Opening outstanding balance' else 'Opening balance' end);
  end if;

  select * into created_wallet from public.wallets where id = created_wallet.id;
  return created_wallet;
end;
$$;

revoke all on function public.create_wallet_with_opening_balance(text, text, text, text, text, numeric, text, numeric) from public;
grant execute on function public.create_wallet_with_opening_balance(text, text, text, text, text, numeric, text, numeric) to authenticated;
