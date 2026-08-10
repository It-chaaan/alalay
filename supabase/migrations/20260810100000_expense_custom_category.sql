alter table public.expenses
  add column if not exists custom_category text;
