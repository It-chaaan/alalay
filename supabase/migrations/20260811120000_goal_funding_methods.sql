alter table public.savings_goals
  add column if not exists funding_method text not null default 'manual';

alter table public.savings_goals
  add column if not exists monthly_contribution numeric not null default 0;

alter table public.savings_goals
  add column if not exists preferred_wallet_id uuid references public.wallets(id) on delete set null;

alter table public.savings_goals
  drop constraint if exists savings_goals_funding_method_check;

alter table public.savings_goals
  add constraint savings_goals_funding_method_check check (funding_method in ('manual', 'monthly'));

alter table public.savings_goals
  add constraint savings_goals_monthly_contribution_check check (monthly_contribution >= 0);

create index if not exists savings_goals_preferred_wallet_idx
  on public.savings_goals (preferred_wallet_id)
  where preferred_wallet_id is not null;

create or replace function public.validate_goal_preferred_wallet()
returns trigger as $$
begin
  if new.preferred_wallet_id is not null and not exists (
    select 1 from public.wallets w where w.id = new.preferred_wallet_id and w.user_id = new.user_id
  ) then
    raise exception 'preferred wallet does not belong to goal owner';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists savings_goals_preferred_wallet_check on public.savings_goals;
create trigger savings_goals_preferred_wallet_check
before insert or update on public.savings_goals
for each row execute function public.validate_goal_preferred_wallet();
