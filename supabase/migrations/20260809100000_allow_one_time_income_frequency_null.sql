alter table public.income
  alter column frequency drop not null,
  alter column frequency set default null;
