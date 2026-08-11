create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  wallet_id uuid references public.wallets(id) on delete restrict,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.goal_contributions enable row level security;
create policy "goal_contributions_select_own" on public.goal_contributions for select using (auth.uid() = user_id);
create policy "goal_contributions_insert_own" on public.goal_contributions for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.savings_goals g where g.id = goal_id and g.user_id = auth.uid() and g.deleted_at is null)
  and (wallet_id is null or exists (select 1 from public.wallets w where w.id = wallet_id and w.user_id = auth.uid()))
);
create policy "goal_contributions_delete_own" on public.goal_contributions for delete using (auth.uid() = user_id);

create index goal_contributions_goal_id_idx on public.goal_contributions (goal_id, created_at desc);
create index goal_contributions_wallet_id_idx on public.goal_contributions (wallet_id) where wallet_id is not null;

create or replace function public.add_goal_contribution(
  target_goal_id uuid,
  source_wallet_id uuid,
  contribution_amount numeric
)
returns public.goal_contributions
language plpgsql
security definer
set search_path = public
as $$
declare
  goal_row public.savings_goals;
  wallet_row public.wallets;
  result_row public.goal_contributions;
  allocated_amount numeric;
begin
  select * into goal_row from public.savings_goals where id = target_goal_id and user_id = auth.uid() and deleted_at is null for update;
  if not found then raise exception 'Goal not found'; end if;
  if contribution_amount <= 0 then raise exception 'Contribution must be greater than zero'; end if;
  if goal_row.current_amount + contribution_amount > goal_row.target_amount then raise exception 'Contribution exceeds the goal target'; end if;

  select * into wallet_row from public.wallets where id = source_wallet_id and user_id = auth.uid() for update;
  if not found then raise exception 'Wallet not found'; end if;
  select coalesce(sum(amount), 0) into allocated_amount from public.goal_contributions where wallet_id = source_wallet_id and user_id = auth.uid();
  if allocated_amount + contribution_amount > wallet_row.balance then raise exception 'This wallet does not have enough unallocated money for that goal contribution'; end if;

  insert into public.goal_contributions (user_id, goal_id, wallet_id, amount)
  values (auth.uid(), target_goal_id, source_wallet_id, contribution_amount)
  returning * into result_row;

  update public.savings_goals
  set current_amount = current_amount + contribution_amount,
      completed_at = case when current_amount + contribution_amount >= target_amount then coalesce(completed_at, now()) else completed_at end,
      updated_at = now()
  where id = target_goal_id;
  return result_row;
end;
$$;

revoke all on function public.add_goal_contribution(uuid, uuid, numeric) from public;
grant execute on function public.add_goal_contribution(uuid, uuid, numeric) to authenticated;
