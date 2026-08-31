-- Income deletion is cancellation/archive, never a hard delete.  The old API
-- issued DELETE against income and depended on a generic trigger; that path
-- was not atomic for recurring schedules and could hit schedule_id FKs.
-- This RPC locks the row, cleans only its own unposted children, and archives
-- the parent in one transaction.  Posted rows remain in the wallet ledger.

create or replace function public.recompute_wallet_balance(target_wallet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.wallets as w
  set balance = case
    when w.account_type = 'credit' then
      coalesce((select sum(a.amount) from public.wallet_adjustments a where a.wallet_id = target_wallet_id), 0)
      + coalesce((select sum(e.amount) from public.expenses e where e.wallet_id = target_wallet_id and e.deleted_at is null), 0)
      + coalesce((select sum(b.amount) from public.bills b where b.wallet_id = target_wallet_id and b.credit_wallet_id is null and b.status = 'paid' and b.deleted_at is null and not exists (select 1 from public.expenses e where e.source_bill_id = b.id and e.deleted_at is null)), 0)
      - coalesce((select sum(r.principal_amount) from public.credit_repayments r where r.credit_wallet_id = target_wallet_id), 0)
    else
      -- Posted income is immutable ledger history; archiving it must not
      -- reduce the wallet balance even when its schedule is cancelled.
      coalesce((select sum(i.amount) from public.income i where i.wallet_id = target_wallet_id and i.is_posted), 0)
      + coalesce((select sum(a.amount) from public.wallet_adjustments a where a.wallet_id = target_wallet_id), 0)
      - coalesce((select sum(e.amount) from public.expenses e where e.wallet_id = target_wallet_id and e.deleted_at is null), 0)
      - coalesce((select sum(b.amount) from public.bills b where b.wallet_id = target_wallet_id and b.credit_wallet_id is null and b.status = 'paid' and b.deleted_at is null and not exists (select 1 from public.expenses e where e.source_bill_id = b.id and e.deleted_at is null)), 0)
      - coalesce((select sum(t.amount) from public.wallet_transfers t where t.from_wallet_id = target_wallet_id), 0)
      + coalesce((select sum(t.amount) from public.wallet_transfers t where t.to_wallet_id = target_wallet_id), 0)
      - coalesce((select sum(l.original_principal) from public.loans l where l.wallet_id = target_wallet_id and l.direction = 'lent'), 0)
      + coalesce((select sum(l.original_principal) from public.loans l where l.wallet_id = target_wallet_id and l.direction = 'borrowed'), 0)
      + coalesce((select sum(p.principal_amount) from public.loan_payments p join public.loans l on l.id = p.loan_id where p.wallet_id = target_wallet_id and l.direction = 'lent'), 0)
      - coalesce((select sum(p.principal_amount) from public.loan_payments p join public.loans l on l.id = p.loan_id where p.wallet_id = target_wallet_id and l.direction = 'borrowed'), 0)
      - coalesce((select sum(r.principal_amount) from public.credit_repayments r where r.payment_wallet_id = target_wallet_id), 0)
  end
  where w.id = target_wallet_id;
end;
$$;

create or replace function public.delete_income(target_income_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  target public.income%rowtype;
  child_count integer := 0;
begin
  if owner_id is null then raise exception 'authentication required' using errcode = '42501'; end if;

  select * into target from public.income
  where id = target_income_id and user_id = owner_id
  for update;
  if not found then raise exception 'income not found' using errcode = 'P0002'; end if;
  if target.deleted_at is not null then
    return jsonb_build_object('id', target.id, 'status', 'already_deleted');
  end if;

  -- Only unposted children are removed. Posted occurrences and their audit
  -- history remain untouched.
  update public.income
  set deleted_at = clock_timestamp(), schedule_status = 'cancelled', updated_at = clock_timestamp()
  where schedule_id = target.id and user_id = owner_id and is_posted = false and deleted_at is null;
  get diagnostics child_count = row_count;

  update public.income
  set deleted_at = clock_timestamp(), schedule_status = case when is_posted then 'cancelled' else 'cancelled' end,
      is_recurring = false, updated_at = clock_timestamp()
  where id = target.id and user_id = owner_id and deleted_at is null;

  return jsonb_build_object('id', target.id, 'status', 'deleted', 'cancelled_occurrences', child_count,
    'preserved_posted_history', exists (select 1 from public.income i where i.schedule_id = target.id and i.is_posted));
end;
$$;

revoke all on function public.delete_income(uuid) from public;
grant execute on function public.delete_income(uuid) to authenticated;
