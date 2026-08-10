-- Preserve the existing primary category for reporting compatibility while
-- allowing an expense to retain every category selected in the mobile form.
alter table public.expenses
  add column if not exists categories text[];

update public.expenses
set categories = array[category]
where categories is null;
