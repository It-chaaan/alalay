-- `process_due_income_schedules` uses `ON CONFLICT (occurrence_key)`.  The
-- previous partial unique index (`WHERE occurrence_key IS NOT NULL`) cannot be
-- inferred by that conflict target, which caused PostgreSQL error 42P10.
--
-- A normal unique constraint accepts multiple NULLs, so it preserves the
-- manual/schedule-definition rows that intentionally have no occurrence key
-- while making the scheduler's exact conflict target valid.

-- Operational duplicate-detection query (read-only):
-- select occurrence_key, count(*) as row_count, array_agg(id order by created_at, id) as income_ids
-- from public.income
-- where occurrence_key is not null
-- group by occurrence_key
-- having count(*) > 1;

-- The old partial index should already make this impossible.  Keep the repair
-- path for databases that drifted from the migration history: retain the
-- earliest ledger row and archive only identical schedule-occurrence copies.
-- A mixed-owner/wallet/schedule collision is not safe to choose automatically,
-- so fail atomically and leave it for explicit operator review.
do $$
declare
  unsafe_key text;
begin
  select occurrence_key into unsafe_key
  from public.income
  where occurrence_key is not null
  group by occurrence_key
  having count(distinct user_id) <> 1
      or count(distinct wallet_id) <> 1
      or count(distinct schedule_id) <> 1
      or count(distinct amount) <> 1
      or count(distinct date) <> 1
      or count(distinct source) <> 1
      or count(distinct type) <> 1
      or count(distinct coalesce(custom_type, '')) <> 1
      or bool_or(not is_posted)
      or bool_or(schedule_status <> 'posted')
      or bool_or(coalesce(source_type, '') <> 'income_schedule')
  limit 1;

  if unsafe_key is not null then
    raise exception
      'Cannot automatically reconcile income occurrence key %: rows are not identical posted schedule occurrences',
      unsafe_key;
  end if;

  with ranked as (
    select id,
           row_number() over (partition by occurrence_key order by created_at, id) as duplicate_rank
    from public.income
    where occurrence_key is not null
  )
  update public.income as duplicate
  set is_posted = false,
      schedule_status = 'cancelled',
      source_type = null,
      received_at = null,
      occurrence_key = null,
      deleted_at = coalesce(duplicate.deleted_at, clock_timestamp()),
      updated_at = clock_timestamp()
  from ranked
  where duplicate.id = ranked.id
    and ranked.duplicate_rank > 1;
end;
$$;

alter table public.income
  drop constraint if exists income_occurrence_key_unique;

drop index if exists public.income_occurrence_key_unique;

alter table public.income
  add constraint income_occurrence_key_unique unique (occurrence_key);
