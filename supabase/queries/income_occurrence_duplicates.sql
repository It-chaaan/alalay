-- Read-only pre-deployment audit for scheduler idempotency keys.
-- It is safe to run against production before applying
-- 20260903100000_income_occurrence_key_constraint.sql.
select
  occurrence_key,
  count(*) as row_count,
  array_agg(id order by created_at, id) as income_ids,
  array_agg(user_id order by created_at, id) as user_ids,
  array_agg(wallet_id order by created_at, id) as wallet_ids,
  array_agg(schedule_id order by created_at, id) as schedule_ids
from public.income
where occurrence_key is not null
group by occurrence_key
having count(*) > 1
order by occurrence_key;
