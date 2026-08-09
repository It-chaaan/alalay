create or replace function public.delete_wallet(target_wallet_id uuid)
returns uuid as $$
declare
  owner_id uuid := auth.uid();
  cash_wallet_id uuid;
begin
  if owner_id is null then
    raise exception 'Authentication is required.';
  end if;

  select id into cash_wallet_id
  from public.wallets
  where user_id = owner_id and is_default_cash
  for update;

  if cash_wallet_id is null then
    raise exception 'A Cash wallet is required before removing another wallet.';
  end if;

  if not exists (
    select 1 from public.wallets
    where id = target_wallet_id and user_id = owner_id and not is_default_cash
  ) then
    raise exception 'Wallet not found or cannot be removed.';
  end if;

  update public.income
  set wallet_id = cash_wallet_id
  where user_id = owner_id and wallet_id = target_wallet_id;

  update public.expenses
  set wallet_id = null
  where user_id = owner_id and wallet_id = target_wallet_id;

  update public.bills
  set wallet_id = null
  where user_id = owner_id and wallet_id = target_wallet_id;

  update public.subscriptions
  set wallet_id = null
  where user_id = owner_id and wallet_id = target_wallet_id;

  delete from public.wallets
  where id = target_wallet_id and user_id = owner_id and not is_default_cash;

  return target_wallet_id;
end;
$$ language plpgsql security definer set search_path = public;
