-- Debit and cash wallets represent assets, while Credit wallet balances are
-- outstanding liabilities. Expenses therefore decrease asset balances but
-- increase a Credit account's outstanding amount.
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
      coalesce((
        select sum(a.amount)
        from public.wallet_adjustments as a
        where a.wallet_id = target_wallet_id
      ), 0)
      + coalesce((
        select sum(e.amount)
        from public.expenses as e
        where e.wallet_id = target_wallet_id and e.deleted_at is null
      ), 0)
      + coalesce((
        select sum(b.amount)
        from public.bills as b
        where b.wallet_id = target_wallet_id
          and b.status = 'paid'
          and b.deleted_at is null
          and not exists (
            select 1
            from public.expenses as e
            where e.source_bill_id = b.id and e.deleted_at is null
          )
      ), 0)
    else
      coalesce((
        select sum(i.amount)
        from public.income as i
        where i.wallet_id = target_wallet_id and i.deleted_at is null
      ), 0)
      + coalesce((
        select sum(a.amount)
        from public.wallet_adjustments as a
        where a.wallet_id = target_wallet_id
      ), 0)
      - coalesce((
        select sum(e.amount)
        from public.expenses as e
        where e.wallet_id = target_wallet_id and e.deleted_at is null
      ), 0)
      - coalesce((
        select sum(b.amount)
        from public.bills as b
        where b.wallet_id = target_wallet_id
          and b.status = 'paid'
          and b.deleted_at is null
          and not exists (
            select 1
            from public.expenses as e
            where e.source_bill_id = b.id and e.deleted_at is null
          )
      ), 0)
      - coalesce((
        select sum(t.amount)
        from public.wallet_transfers as t
        where t.from_wallet_id = target_wallet_id
      ), 0)
      + coalesce((
        select sum(t.amount)
        from public.wallet_transfers as t
        where t.to_wallet_id = target_wallet_id
      ), 0)
      - coalesce((
        select sum(l.original_principal)
        from public.loans as l
        where l.wallet_id = target_wallet_id and l.direction = 'lent'
      ), 0)
      + coalesce((
        select sum(l.original_principal)
        from public.loans as l
        where l.wallet_id = target_wallet_id and l.direction = 'borrowed'
      ), 0)
      + coalesce((
        select sum(p.principal_amount)
        from public.loan_payments as p
        join public.loans as l on l.id = p.loan_id
        where p.wallet_id = target_wallet_id and l.direction = 'lent'
      ), 0)
      - coalesce((
        select sum(p.principal_amount)
        from public.loan_payments as p
        join public.loans as l on l.id = p.loan_id
        where p.wallet_id = target_wallet_id and l.direction = 'borrowed'
      ), 0)
  end
  where w.id = target_wallet_id;
end;
$$;
