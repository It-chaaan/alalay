alter table public.income
  add column if not exists frequency text not null default 'monthly';

alter table public.income
  add constraint income_frequency_check
  check (frequency in ('monthly', 'weekly', 'biweekly', 'yearly'));
