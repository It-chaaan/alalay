-- A savings-goal deletion is an archive operation.  It must not rely on a
-- caller-visible UPDATE of deleted_at: active-goal SELECT policies intentionally
-- hide the resulting row, which can make PostgreSQL reject the new row under
-- RLS.  Keep the owner check explicit and release reservations atomically.
create or replace function public.delete_savings_goal(target_goal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  goal_row public.savings_goals;
  contribution_row public.goal_contributions;
  outstanding_amount numeric;
begin
  if actor_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  -- Lock the active goal first.  This serializes duplicate DELETE requests and
  -- prevents duplicate release records.
  select g.* into goal_row
  from public.savings_goals as g
  where g.id = target_goal_id
    and g.user_id = actor_id
    and g.deleted_at is null
  for update;

  if not found then
    raise exception 'Savings goal not found' using errcode = 'P0002';
  end if;

  -- Contributions reserve wallet funds; releasing them records the release in
  -- the immutable ledger but intentionally does not alter wallet.balance.
  for contribution_row in
    select gc.*
    from public.goal_contributions as gc
    where gc.goal_id = goal_row.id and gc.user_id = actor_id
    for update
  loop
    select contribution_row.amount - coalesce(sum(r.amount), 0)
      into outstanding_amount
    from public.goal_contribution_releases as r
    where r.contribution_id = contribution_row.id
      and r.user_id = actor_id;

    if outstanding_amount > 0 then
      insert into public.goal_contribution_releases (
        user_id, contribution_id, amount, released_on, note
      ) values (
        actor_id, contribution_row.id, outstanding_amount,
        (now() at time zone 'Asia/Manila')::date,
        'Released because the savings goal was deleted'
      );
    end if;
  end loop;

  update public.savings_goals
  set current_amount = 0,
      completed_at = null,
      deleted_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = goal_row.id and user_id = actor_id and deleted_at is null;

  return goal_row.id;
end;
$$;

revoke all on function public.delete_savings_goal(uuid) from public;
grant execute on function public.delete_savings_goal(uuid) to authenticated;

notify pgrst, 'reload schema';
