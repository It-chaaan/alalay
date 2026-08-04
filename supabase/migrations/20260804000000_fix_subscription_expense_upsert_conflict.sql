-- PostgREST generates ON CONFLICT (user_id, subscription_id, occurrence_date, billing_cycle)
-- for the subscription billing upsert. PostgreSQL cannot infer a partial unique index
-- unless the conflict target also includes its predicate, which PostgREST does not send.
drop index if exists public.expenses_subscription_occurrence_unique;

create unique index expenses_subscription_occurrence_unique
  on public.expenses (user_id, subscription_id, occurrence_date, billing_cycle);
