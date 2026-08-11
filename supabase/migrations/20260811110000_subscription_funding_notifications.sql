alter table public.notifications_log
  add column if not exists related_wallet_id uuid references public.wallets(id) on delete set null;

alter table public.notifications_log
  drop constraint if exists notifications_log_type_check;

alter table public.notifications_log
  add constraint notifications_log_type_check check (type in ('bill_due', 'subscription_renewal', 'subscription_funding_warning', 'monthly_summary'));

create index if not exists notifications_log_wallet_idx
  on public.notifications_log (user_id, type, related_wallet_id, period_key);

create unique index if not exists notifications_log_subscription_occurrence_unique
  on public.notifications_log (user_id, type, related_subscription_id, period_key)
  where related_subscription_id is not null and period_key is not null and status = 'sent';

create unique index if not exists notifications_log_wallet_occurrence_unique
  on public.notifications_log (user_id, type, related_wallet_id, period_key)
  where related_wallet_id is not null and period_key is not null and status = 'sent';

-- Existing wallet deletion used to null out subscription links. Active
-- subscriptions now require an explicit reassignment instead.
create or replace function public.delete_wallet(target_wallet_id uuid)
returns uuid as $$
declare
  owner_id uuid := auth.uid();
  cash_wallet_id uuid;
  active_subscription_count integer;
begin
  if owner_id is null then raise exception 'Authentication is required.'; end if;

  select id into cash_wallet_id from public.wallets
  where user_id = owner_id and is_default_cash for update;
  if cash_wallet_id is null then raise exception 'A Cash wallet is required before removing another wallet.'; end if;

  if not exists (select 1 from public.wallets where id = target_wallet_id and user_id = owner_id and not is_default_cash) then
    raise exception 'Wallet not found or cannot be removed.';
  end if;

  select count(*) into active_subscription_count from public.subscriptions
  where user_id = owner_id and wallet_id = target_wallet_id and auto_renew = true and deleted_at is null;
  if active_subscription_count > 0 then
    raise exception 'This wallet is used by active subscriptions. Reassign them before deleting it.';
  end if;

  update public.income set wallet_id = cash_wallet_id where user_id = owner_id and wallet_id = target_wallet_id;
  update public.expenses set wallet_id = null where user_id = owner_id and wallet_id = target_wallet_id;
  update public.bills set wallet_id = null where user_id = owner_id and wallet_id = target_wallet_id;
  update public.subscriptions set wallet_id = null where user_id = owner_id and wallet_id = target_wallet_id;
  delete from public.wallets where id = target_wallet_id and user_id = owner_id and not is_default_cash;
  return target_wallet_id;
end;
$$ language plpgsql security definer set search_path = public;
