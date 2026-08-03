-- Migrate legacy Utilities records when the biller/merchant gives us a
-- recognizable service. Rows that do not match intentionally remain
-- Utilities so they are easy to find and review manually.

update public.bills
set category = case
  when lower(title) like any (array['%meralco%', '%veco%', '%visayan electric%', '%davao light%', '%electric%']) then 'Electricity'
  when lower(title) like any (array['%maynilad%', '%manila water%', '%primewater%', '%water%']) then 'Water'
  when lower(title) like any (array['%pldt%', '%globe%', '%converge%', '%sky cable%', '%internet%', '%wifi%', '%broadband%']) then 'Internet'
  else category
end
where category = 'Utilities';

update public.expenses
set category = case
  when lower(merchant) like any (array['%meralco%', '%veco%', '%visayan electric%', '%davao light%', '%electric%']) then 'Electricity'
  when lower(merchant) like any (array['%maynilad%', '%manila water%', '%primewater%', '%water%']) then 'Water'
  when lower(merchant) like any (array['%pldt%', '%globe%', '%converge%', '%sky cable%', '%internet%', '%wifi%', '%broadband%']) then 'Internet'
  else category
end
where category = 'Utilities';

-- Replace each legacy Utilities budget row with three equal allocations.
-- The existing 15,000 row therefore becomes 5,000 per category.
with expanded as (
  select
    budget_plan_id,
    ordinal,
    1 as category_order,
    category
  from (
    select
      budget_plans.id as budget_plan_id,
      item.ordinal,
      item.category
    from public.budget_plans
    cross join lateral jsonb_array_elements(budget_plans.categories) with ordinality as item(category, ordinal)
  ) source
  where lower(category->>'name') <> 'utilities'

  union all

  select budget_plan_id, ordinal, 1, jsonb_set(jsonb_set(jsonb_set(category,
    '{id}', to_jsonb(coalesce(category->>'id', 'utilities') || '-water')),
    '{name}', to_jsonb('Water'::text)),
    '{budget}', to_jsonb(coalesce(nullif(category->>'budget', '')::numeric, 0) / 3))
  from (
    select budget_plans.id as budget_plan_id, item.ordinal, item.category
    from public.budget_plans
    cross join lateral jsonb_array_elements(budget_plans.categories) with ordinality as item(category, ordinal)
  ) source
  where lower(category->>'name') = 'utilities'

  union all

  select budget_plan_id, ordinal, 2, jsonb_set(jsonb_set(jsonb_set(category,
    '{id}', to_jsonb(coalesce(category->>'id', 'utilities') || '-electricity')),
    '{name}', to_jsonb('Electricity'::text)),
    '{budget}', to_jsonb(coalesce(nullif(category->>'budget', '')::numeric, 0) / 3))
  from (
    select budget_plans.id as budget_plan_id, item.ordinal, item.category
    from public.budget_plans
    cross join lateral jsonb_array_elements(budget_plans.categories) with ordinality as item(category, ordinal)
  ) source
  where lower(category->>'name') = 'utilities'

  union all

  select budget_plan_id, ordinal, 3, jsonb_set(jsonb_set(jsonb_set(category,
    '{id}', to_jsonb(coalesce(category->>'id', 'utilities') || '-internet')),
    '{name}', to_jsonb('Internet'::text)),
    '{budget}', to_jsonb(coalesce(nullif(category->>'budget', '')::numeric, 0) / 3))
  from (
    select budget_plans.id as budget_plan_id, item.ordinal, item.category
    from public.budget_plans
    cross join lateral jsonb_array_elements(budget_plans.categories) with ordinality as item(category, ordinal)
  ) source
  where lower(category->>'name') = 'utilities'
), regrouped as (
  select budget_plan_id, jsonb_agg(category order by ordinal, category_order) as categories
  from expanded
  group by budget_plan_id
)
update public.budget_plans
set categories = regrouped.categories
from regrouped
where budget_plans.id = regrouped.budget_plan_id;
