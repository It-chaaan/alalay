-- Goal allocations reserve money held in a wallet.  The reservation is derived
-- from canonical contribution/release records; wallets.balance remains the
-- physical total and is never changed by either operation.
create table if not exists public.goal_contribution_releases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  contribution_id uuid not null references public.goal_contributions(id) on delete restrict,
  amount numeric not null check (amount > 0),
  released_on date not null default ((now() at time zone 'Asia/Manila')::date),
  note text,
  idempotency_key text,
  created_at timestamptz not null default now()
);
alter table public.goal_contribution_releases enable row level security;
create policy goal_contribution_releases_select_own on public.goal_contribution_releases
  for select using (auth.uid() = user_id);
create unique index if not exists goal_contribution_releases_idempotency_unique
  on public.goal_contribution_releases(user_id, idempotency_key) where idempotency_key is not null;
create index if not exists goal_contribution_releases_contribution_idx
  on public.goal_contribution_releases(contribution_id, created_at);

create or replace view public.wallet_reserved_balances
with (security_invoker = true) as
select
  w.id as wallet_id,
  w.user_id,
  coalesce(sum(gc.amount - coalesce(releases.released_amount, 0)), 0)::numeric as reserved_balance
from public.wallets as w
left join public.goal_contributions as gc
  on gc.wallet_id = w.id
  and gc.user_id = w.user_id
left join lateral (
  select coalesce(sum(r.amount), 0) as released_amount
  from public.goal_contribution_releases as r
  where r.contribution_id = gc.id and r.user_id = gc.user_id
) as releases on true
group by w.id, w.user_id;
grant select on public.wallet_reserved_balances to authenticated;

create or replace function public.add_goal_contribution(
  target_goal_id uuid, source_wallet_id uuid, contribution_amount numeric,
  contribution_on date default ((now() at time zone 'Asia/Manila')::date),
  contribution_note text default null, request_id text default null
)
returns public.goal_contributions language plpgsql security definer
set search_path = pg_catalog, public as $$
declare
  actor_id uuid := auth.uid();
  goal_row public.savings_goals;
  wallet_row public.wallets;
  result_row public.goal_contributions;
  reserved numeric;
begin
  if actor_id is null then raise exception 'Authentication is required'; end if;
  if contribution_amount <= 0 or contribution_amount <> pg_catalog.trunc(contribution_amount, 2) then
    raise exception 'Contribution must be a positive currency amount';
  end if;
  if contribution_on is null then raise exception 'Contribution date is required'; end if;
  if request_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text || ':' || request_id, 0));
    select gc.* into result_row from public.goal_contributions gc
    where gc.user_id = actor_id and gc.idempotency_key = request_id;
    if found then return result_row; end if;
  end if;
  select g.* into goal_row from public.savings_goals g
  where g.id = target_goal_id and g.user_id = actor_id and g.deleted_at is null for update;
  if not found then raise exception 'Goal not found'; end if;
  select w.* into wallet_row from public.wallets w
  where w.id = source_wallet_id and w.user_id = actor_id for update;
  if not found then raise exception 'Wallet not found'; end if;
  select coalesce(sum(gc.amount - coalesce(releases.released_amount, 0)), 0) into reserved
  from public.goal_contributions gc
  left join lateral (
    select coalesce(sum(r.amount), 0) as released_amount
    from public.goal_contribution_releases r where r.contribution_id = gc.id and r.user_id = actor_id
  ) releases on true
  where gc.wallet_id = source_wallet_id and gc.user_id = actor_id;
  if contribution_amount > wallet_row.balance - reserved then
    raise exception 'This wallet has only % available because % is reserved for Savings Goals',
      wallet_row.balance - reserved, reserved;
  end if;
  if goal_row.current_amount + contribution_amount > goal_row.target_amount then raise exception 'Contribution exceeds the goal target'; end if;
  insert into public.goal_contributions(user_id, goal_id, wallet_id, amount, contribution_date, note, idempotency_key)
  values(actor_id, target_goal_id, source_wallet_id, contribution_amount, contribution_on, nullif(trim(contribution_note), ''), request_id)
  returning * into result_row;
  update public.savings_goals g set current_amount = g.current_amount + contribution_amount,
    completed_at = case when g.current_amount + contribution_amount >= g.target_amount then coalesce(g.completed_at, now()) else g.completed_at end,
    updated_at = now() where g.id = target_goal_id and g.user_id = actor_id;
  return result_row;
end; $$;

create or replace function public.release_goal_contribution(
  target_contribution_id uuid, release_amount numeric,
  released_on_value date default ((now() at time zone 'Asia/Manila')::date),
  release_note text default null, request_id text default null
)
returns public.goal_contribution_releases language plpgsql security definer
set search_path = pg_catalog, public as $$
declare actor_id uuid := auth.uid(); contribution public.goal_contributions; result public.goal_contribution_releases; already_released numeric;
begin
  if actor_id is null then raise exception 'Authentication is required'; end if;
  if release_amount <= 0 or release_amount <> pg_catalog.trunc(release_amount, 2) then raise exception 'Release must be a positive currency amount'; end if;
  if request_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_id::text || ':release:' || request_id, 0));
    select r.* into result from public.goal_contribution_releases r where r.user_id = actor_id and r.idempotency_key = request_id;
    if found then return result; end if;
  end if;
  select gc.* into contribution from public.goal_contributions gc where gc.id = target_contribution_id and gc.user_id = actor_id for update;
  if not found then raise exception 'Goal contribution not found'; end if;
  select coalesce(sum(r.amount), 0) into already_released from public.goal_contribution_releases r where r.contribution_id = contribution.id and r.user_id = actor_id;
  if release_amount > contribution.amount - already_released then raise exception 'Release exceeds reserved funds'; end if;
  insert into public.goal_contribution_releases(user_id, contribution_id, amount, released_on, note, idempotency_key)
  values(actor_id, contribution.id, release_amount, coalesce(released_on_value, current_date), nullif(trim(release_note), ''), request_id)
  returning * into result;
  update public.savings_goals g set current_amount = g.current_amount - release_amount,
    completed_at = case when g.current_amount - release_amount < g.target_amount then null else g.completed_at end,
    updated_at = now() where g.id = contribution.goal_id and g.user_id = actor_id;
  return result;
end; $$;

revoke all on function public.add_goal_contribution(uuid, uuid, numeric, date, text, text) from public;
grant execute on function public.add_goal_contribution(uuid, uuid, numeric, date, text, text) to authenticated;
revoke all on function public.release_goal_contribution(uuid, numeric, date, text, text) from public;
grant execute on function public.release_goal_contribution(uuid, numeric, date, text, text) to authenticated;
notify pgrst, 'reload schema';
