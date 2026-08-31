-- A posted income row is the wallet ledger transaction for an income
-- occurrence.  Schedules never affect a balance; a generated row has a
-- schedule_id/occurrence_key and is the immutable transaction reference.
alter table public.income
  add column if not exists received_at timestamptz,
  add column if not exists source_type text;

alter table public.income
  drop constraint if exists income_source_type_check;
alter table public.income
  add constraint income_source_type_check
  check (source_type is null or source_type in ('manual', 'income_schedule'));

-- Historical rows predate an actual-posted timestamp.  Preserve their known
-- calendar date at Manila midnight rather than fabricating a current receipt.
update public.income
set received_at = (date::timestamp at time zone 'Asia/Manila'),
    source_type = coalesce(source_type, case when schedule_id is null then 'manual' else 'income_schedule' end)
where is_posted = true and (received_at is null or source_type is null);

create or replace function public.validate_income_occurrence_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent public.income%rowtype;
begin
  if new.is_posted then
    if new.received_at is null then
      raise exception 'posted income requires received_at';
    end if;
    if new.schedule_id is not null then
      select * into parent from public.income where id = new.schedule_id;
      if not found or parent.user_id <> new.user_id or parent.wallet_id <> new.wallet_id
        or parent.is_posted or parent.schedule_status not in ('active', 'completed') then
        raise exception 'invalid income occurrence schedule link';
      end if;
      if new.source_type <> 'income_schedule' then
        raise exception 'scheduled income occurrence requires income_schedule source type';
      end if;
    elsif new.source_type <> 'manual' then
      raise exception 'manual posted income requires manual source type';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists income_occurrence_link_check on public.income;
create trigger income_occurrence_link_check
before insert or update on public.income
for each row execute function public.validate_income_occurrence_link();

-- This function is deliberately a single database transaction.  A unique
-- occurrence_key is the idempotency key; inserting the ledger row, recording
-- the receipt timestamp, advancing/completing the schedule, and the existing
-- balance trigger therefore either all commit or all roll back together.
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
  for schedule_row in
    select * from public.income
    where is_posted = false and schedule_status = 'active' and deleted_at is null and date <= due_today
    order by date, id
    for update skip locked
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
    if coalesce(schedule_row.is_recurring, false) then
      update public.income set date = public.add_income_cycle(schedule_row.date, schedule_row.frequency), updated_at = posted_at
      where id = schedule_row.id;
    else
      update public.income set schedule_status = 'completed', updated_at = posted_at
      where id = schedule_row.id;
    end if;
  end loop;
  return processed;
end;
$$;
