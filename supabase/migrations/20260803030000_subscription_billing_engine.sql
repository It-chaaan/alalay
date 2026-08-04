alter table public.expenses
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists billing_cycle text,
  add column if not exists occurrence_date date,
  add column if not exists generated_by text,
  add column if not exists recurrence_key text,
  add column if not exists billing_status text,
  add column if not exists generated_at timestamptz;

alter table public.expenses
  add constraint expenses_billing_cycle_check
  check (billing_cycle is null or billing_cycle in ('weekly', 'monthly', 'quarterly', 'yearly'));

alter table public.expenses
  add constraint expenses_generated_by_check
  check (generated_by is null or generated_by in ('subscription'));

alter table public.expenses
  add constraint expenses_billing_status_check
  check (billing_status is null or billing_status in ('generated', 'paid', 'void'));

create unique index expenses_subscription_occurrence_unique
  on public.expenses (user_id, subscription_id, occurrence_date, billing_cycle)
  where subscription_id is not null and occurrence_date is not null and billing_cycle is not null;

create index expenses_subscription_id_idx on public.expenses (subscription_id)
  where subscription_id is not null;

alter table public.subscriptions drop constraint if exists subscriptions_billing_cycle_check;
alter table public.subscriptions
  add constraint subscriptions_billing_cycle_check
  check (billing_cycle in ('weekly', 'monthly', 'quarterly', 'yearly'));
