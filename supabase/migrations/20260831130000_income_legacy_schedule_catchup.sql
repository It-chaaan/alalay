-- Legacy rows created before the schedule contract can have the internally
-- contradictory combination is_posted=false / schedule_status=posted. They
-- are schedules, not historical income, and can be repaired without changing
-- IDs, created_at, wallet links, or ledger balances.
create or replace function public.repair_legacy_income_schedules()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare repaired integer := 0;
begin
  with repaired_rows as (
    update public.income i
    set schedule_status = 'active',
        frequency = lower(i.frequency),
        updated_at = now()
    where i.deleted_at is null
      and i.is_recurring = true
      and i.is_posted = false
      and i.schedule_status = 'posted'
      and lower(coalesce(i.frequency, '')) in ('weekly', 'biweekly', 'monthly', 'yearly')
      and exists (
        select 1 from public.wallets w where w.id = i.wallet_id and w.user_id = i.user_id
      )
    returning 1
  ) select count(*) into repaired from repaired_rows;
  return repaired;
end;
$$;

-- Automatic-income policy: every missed recurrence is a separate occurrence.
-- The occurrence key is the database idempotency key; re-running this function
-- cannot duplicate wallet credits. It never relates generic deposits by amount.
create or replace function public.process_due_income_schedules()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  schedule_row public.income%rowtype;
  posted_id uuid;
  occurrence text;
  due_today date := (now() at time zone 'Asia/Manila')::date;
  processed integer := 0;
  posted_at timestamptz := now();
begin
  perform public.repair_legacy_income_schedules();
  for schedule_row in
    select * from public.income
    where is_posted = false and schedule_status = 'active' and deleted_at is null and date <= due_today
    order by date, id
    for update skip locked
  loop
    loop
      occurrence := schedule_row.id::text || ':' || schedule_row.date::text;
      insert into public.income (
        user_id, wallet_id, source, type, custom_type, amount, date,
        is_recurring, frequency, is_posted, schedule_status, schedule_id,
        occurrence_key, source_type, received_at
      ) values (
        schedule_row.user_id, schedule_row.wallet_id, schedule_row.source,
        schedule_row.type, schedule_row.custom_type, schedule_row.amount,
        schedule_row.date, false, null, true, 'posted', schedule_row.id,
        occurrence, 'income_schedule', posted_at
      ) on conflict (occurrence_key) do nothing returning id into posted_id;
      if posted_id is not null then processed := processed + 1; end if;

      if not coalesce(schedule_row.is_recurring, false) then
        update public.income set schedule_status = 'completed', updated_at = posted_at where id = schedule_row.id;
        exit;
      end if;
      update public.income
      set date = public.add_income_cycle(schedule_row.date, schedule_row.frequency), updated_at = posted_at
      where id = schedule_row.id
      returning * into schedule_row;
      exit when schedule_row.date > due_today;
    end loop;
  end loop;
  return processed;
end;
$$;

revoke all on function public.repair_legacy_income_schedules() from public;
grant execute on function public.repair_legacy_income_schedules() to service_role;
