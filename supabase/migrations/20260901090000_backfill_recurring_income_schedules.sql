-- Before the schedule contract, recurring income was stored as a single
-- posted ledger row. It therefore had recurrence metadata but no active row
-- to project into a later month. Preserve that ledger history and create one
-- independent schedule definition for each such legacy source.

create or replace function public.backfill_legacy_recurring_income_schedules(
  as_of date default (now() at time zone 'Asia/Manila')::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  legacy_row public.income%rowtype;
  scheduled_date date;
  inserted integer := 0;
begin
  for legacy_row in
    select * from public.income i
    where i.deleted_at is null
      and i.is_posted = true
      and i.schedule_status = 'posted'
      and i.is_recurring = true
      and i.schedule_id is null
      and lower(coalesce(i.frequency, '')) in ('weekly', 'biweekly', 'monthly', 'yearly')
      and exists (
        select 1 from public.wallets w where w.id = i.wallet_id and w.user_id = i.user_id
      )
      -- An unposted child is the durable marker that this legacy row has
      -- already been backfilled. It also lets the existing deletion RPC
      -- cancel the schedule when the source record is deleted.
      and not exists (
        select 1 from public.income child
        where child.schedule_id = i.id and child.is_posted = false
      )
    for update
  loop
    scheduled_date := public.add_income_cycle(legacy_row.date, lower(legacy_row.frequency));
    -- Do not manufacture missed historical credits during migration. Advance
    -- to the first future Manila occurrence; the normal scheduler owns every
    -- occurrence from this point forward.
    while scheduled_date <= as_of loop
      scheduled_date := public.add_income_cycle(scheduled_date, lower(legacy_row.frequency));
    end loop;

    insert into public.income (
      user_id, wallet_id, source, type, custom_type, amount, date,
      is_recurring, frequency, is_posted, schedule_status, schedule_id,
      occurrence_key, source_type, received_at
    ) values (
      legacy_row.user_id, legacy_row.wallet_id, legacy_row.source,
      legacy_row.type, legacy_row.custom_type, legacy_row.amount, scheduled_date,
      true, lower(legacy_row.frequency), false, 'active', legacy_row.id,
      null, null, null
    );
    inserted := inserted + 1;
  end loop;
  return inserted;
end;
$$;

select public.backfill_legacy_recurring_income_schedules();

revoke all on function public.backfill_legacy_recurring_income_schedules(date) from public;
grant execute on function public.backfill_legacy_recurring_income_schedules(date) to service_role;
