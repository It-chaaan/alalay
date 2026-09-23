-- A wallet may be reclassified as credit after an income schedule was made.
-- Continue rejecting any new or redirected income targeting that wallet, but
-- allow unrelated updates so the scheduler can mark the stale schedule failed.
create or replace function public.validate_wallet_workflow()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.wallet_id is not null and not exists (
    select 1
    from public.wallets as wallet
    where wallet.id = new.wallet_id and wallet.user_id = new.user_id
  ) then
    raise exception 'wallet does not belong to transaction owner';
  end if;

  if tg_table_name = 'income'
    and new.wallet_id is not null
    and exists (
      select 1
      from public.wallets as wallet
      where wallet.id = new.wallet_id
        and wallet.user_id = new.user_id
        and wallet.account_type = 'credit'
    ) then
    if tg_op = 'INSERT' then
      raise exception 'Credit cards cannot receive income';
    end if;
    if new.wallet_id is distinct from old.wallet_id
      or new.user_id is distinct from old.user_id
      or new.is_posted is distinct from old.is_posted then
      raise exception 'Credit cards cannot receive income';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_wallet_workflow() from public, anon, authenticated;
grant execute on function public.validate_wallet_workflow() to service_role;
