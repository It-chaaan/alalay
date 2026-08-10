alter table public.income
  add column if not exists custom_type text;

alter table public.subscriptions
  add column if not exists category text;

alter table public.subscriptions
  add column if not exists custom_category text;
