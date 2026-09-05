-- Wallets are hard-deleted (there is no wallets.deleted_at). Savings goals
-- retain their canonical soft-delete lifecycle, so only the goal check stays.
create or replace function public.add_goal_contribution(
  target_goal_id uuid,
  source_wallet_id uuid,
  contribution_amount numeric,
  contribution_on date default ((now() at time zone 'Asia/Manila')::date),
  contribution_note text default null,
  request_id text default null
)
returns public.goal_contributions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  goal_row public.savings_goals;
  wallet_row public.wallets;
  result_row public.goal_contributions;
  allocated numeric;
begin
  if actor_id is null then
    raise exception 'Authentication is required';
  end if;

  if contribution_amount <= 0 or contribution_amount <> pg_catalog.trunc(contribution_amount, 2) then
    raise exception 'Contribution must be a positive currency amount';
  end if;
  if contribution_on is null then
    raise exception 'Contribution date is required';
  end if;

  -- Serialize repeated requests so the unique idempotency index is not exposed
  -- as a race to API callers.
  if request_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text || ':' || request_id, 0));
    select gc.* into result_row
    from public.goal_contributions as gc
    where gc.user_id = actor_id and gc.idempotency_key = request_id;
    if found then
      return result_row;
    end if;
  end if;

  select g.* into goal_row
  from public.savings_goals as g
  where g.id = target_goal_id
    and g.user_id = actor_id
    and g.deleted_at is null
  for update;
  if not found then
    raise exception 'Goal not found';
  end if;

  select w.* into wallet_row
  from public.wallets as w
  where w.id = source_wallet_id
    and w.user_id = actor_id
  for update;
  if not found then
    raise exception 'Wallet not found';
  end if;

  select coalesce(sum(gc.amount), 0) into allocated
  from public.goal_contributions as gc
  where gc.wallet_id = source_wallet_id
    and gc.user_id = actor_id
    and gc.released_at is null;
  if allocated + contribution_amount > wallet_row.balance then
    raise exception 'This wallet does not have enough available money';
  end if;
  if goal_row.current_amount + contribution_amount > goal_row.target_amount then
    raise exception 'Contribution exceeds the goal target';
  end if;

  insert into public.goal_contributions (
    user_id, goal_id, wallet_id, amount, contribution_date, note, idempotency_key
  ) values (
    actor_id, target_goal_id, source_wallet_id, contribution_amount, contribution_on,
    nullif(trim(contribution_note), ''), request_id
  ) returning * into result_row;

  update public.savings_goals as g
  set current_amount = g.current_amount + contribution_amount,
      completed_at = case
        when g.current_amount + contribution_amount >= g.target_amount
          then coalesce(g.completed_at, now())
        else g.completed_at
      end,
      updated_at = now()
  where g.id = target_goal_id and g.user_id = actor_id;

  return result_row;
end;
$$;

revoke all on function public.add_goal_contribution(uuid, uuid, numeric, date, text, text) from public;
grant execute on function public.add_goal_contribution(uuid, uuid, numeric, date, text, text) to authenticated;

notify pgrst, 'reload schema';
