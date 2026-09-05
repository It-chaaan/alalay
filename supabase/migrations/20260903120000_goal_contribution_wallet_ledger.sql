-- Reserved-allocation model: physical wallet balance is unchanged; active
-- wallet-backed contributions reserve part of it and are shown as outgoing.
alter table public.goal_contributions
  add column if not exists note text,
  add column if not exists wallet_transaction_amount numeric generated always as (-amount) stored;

create or replace function public.add_goal_contribution(
  target_goal_id uuid,
  source_wallet_id uuid,
  contribution_amount numeric,
  contribution_on date default ((now() at time zone 'Asia/Manila')::date),
  contribution_note text default null,
  request_id text default null
)
returns public.goal_contributions
language plpgsql security definer set search_path = public as $$
declare goal_row public.savings_goals; wallet_row public.wallets; result_row public.goal_contributions; allocated numeric;
begin
  if contribution_amount <= 0 or contribution_amount <> trunc(contribution_amount, 2) then raise exception 'Contribution must be a positive currency amount'; end if;
  if contribution_on is null then raise exception 'Contribution date is required'; end if;
  if request_id is not null then
    select * into result_row from public.goal_contributions where user_id = auth.uid() and idempotency_key = request_id;
    if found then return result_row; end if;
  end if;
  select * into goal_row from public.savings_goals where id = target_goal_id and user_id = auth.uid() and deleted_at is null for update;
  if not found then raise exception 'Goal not found'; end if;
  select * into wallet_row from public.wallets where id = source_wallet_id and user_id = auth.uid() and deleted_at is null for update;
  if not found then raise exception 'Wallet not found or inactive'; end if;
  select coalesce(sum(amount), 0) into allocated from public.goal_contributions where wallet_id = source_wallet_id and user_id = auth.uid() and released_at is null;
  if allocated + contribution_amount > wallet_row.balance then raise exception 'This wallet does not have enough available money'; end if;
  if goal_row.current_amount + contribution_amount > goal_row.target_amount then raise exception 'Contribution exceeds the goal target'; end if;
  insert into public.goal_contributions (user_id, goal_id, wallet_id, amount, contribution_date, note, idempotency_key)
  values (auth.uid(), target_goal_id, source_wallet_id, contribution_amount, contribution_on, nullif(trim(contribution_note), ''), request_id)
  returning * into result_row;
  update public.savings_goals set current_amount = current_amount + contribution_amount, completed_at = case when current_amount + contribution_amount >= target_amount then coalesce(completed_at, now()) else completed_at end, updated_at = now() where id = target_goal_id;
  return result_row;
end; $$;

revoke all on function public.add_goal_contribution(uuid, uuid, numeric, date, text, text) from public;
grant execute on function public.add_goal_contribution(uuid, uuid, numeric, date, text, text) to authenticated;

-- Reconciliation report only: historical rows are never re-linked or deducted.
create or replace view public.goal_contribution_reconciliation as
select g.id goal_id, g.user_id, g.title, g.current_amount, coalesce(sum(c.amount) filter (where c.released_at is null), 0) contribution_total,
       count(c.id) filter (where c.wallet_id is null) unlinked_contributions,
       count(c.id) filter (where c.amount = 0) zero_value_contributions
from public.savings_goals g left join public.goal_contributions c on c.goal_id = g.id group by g.id;
