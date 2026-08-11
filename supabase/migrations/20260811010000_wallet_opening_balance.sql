create or replace function public.create_wallet_with_opening_balance(
  wallet_name text,
  wallet_type text,
  wallet_key text,
  wallet_color text,
  wallet_icon text,
  opening_amount numeric
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

  insert into public.wallets (user_id, name, institution_type, institution_key, color, icon, is_default_cash)
  values (auth.uid(), trim(wallet_name), wallet_type, trim(wallet_key), coalesce(wallet_color, '#0F8A6B'), wallet_icon, false)
  returning * into created_wallet;

  if opening_amount > 0 then
    insert into public.wallet_adjustments (user_id, wallet_id, amount, date, note)
    values (auth.uid(), created_wallet.id, opening_amount, current_date, 'Opening balance');
  end if;

  select * into created_wallet from public.wallets where id = created_wallet.id;
  return created_wallet;
end;
$$;

revoke all on function public.create_wallet_with_opening_balance(text, text, text, text, text, numeric) from public;
grant execute on function public.create_wallet_with_opening_balance(text, text, text, text, text, numeric) to authenticated;
