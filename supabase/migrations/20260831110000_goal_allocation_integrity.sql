-- Goal contributions are allocations of money already held in a wallet. They
-- are deliberately not expenses, income, or wallet-balance debits.
alter table public.goal_contributions
  add column if not exists funding_source_type text not null default 'wallet',
  add column if not exists idempotency_key text,
  add column if not exists contribution_date date not null default ((now() at time zone 'Asia/Manila')::date),
  add column if not exists released_at timestamptz,
  add column if not exists release_reference text;

alter table public.goal_contributions drop constraint if exists goal_contributions_source_check;
alter table public.goal_contributions add constraint goal_contributions_source_check
  check (funding_source_type in ('wallet', 'external', 'adjustment'));
alter table public.goal_contributions add constraint goal_contributions_wallet_source_check
  check ((funding_source_type = 'wallet' and wallet_id is not null) or funding_source_type <> 'wallet');
create unique index if not exists goal_contributions_idempotency_unique
  on public.goal_contributions(user_id, idempotency_key) where idempotency_key is not null;

-- A completed amount must be backed by contribution records. Existing data
-- without a verifiable source is intentionally not invented or relinked.
create or replace function public.validate_goal_progress_is_allocated()
returns trigger language plpgsql security definer set search_path = public as $$
declare allocated numeric;
begin
  if new.current_amount > old.current_amount then
    select coalesce(sum(amount), 0) into allocated from public.goal_contributions
    where goal_id = new.id and user_id = new.user_id and released_at is null;
    if allocated < new.current_amount then
      raise exception 'Goal progress must be backed by goal contribution records';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists savings_goal_progress_allocation_check on public.savings_goals;
create trigger savings_goal_progress_allocation_check before update of current_amount on public.savings_goals
for each row execute function public.validate_goal_progress_is_allocated();
