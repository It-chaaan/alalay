alter table public.budget_plans
  add column if not exists month text;

update public.budget_plans
set month = to_char(current_date, 'YYYY-MM')
where month is null;

alter table public.budget_plans
  alter column month set not null;

alter table public.budget_plans
  drop constraint if exists budget_plans_user_id_key;

alter table public.budget_plans
  add constraint budget_plans_user_month_key unique (user_id, month);

alter table public.budget_plans
  add constraint budget_plans_month_check check (month ~ '^\d{4}-(0[1-9]|1[0-2])$');

create index if not exists budget_plans_user_month_idx
  on public.budget_plans (user_id, month);
