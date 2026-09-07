-- Create recurring income schedules and materialize a Manila-due occurrence
-- in one transaction. The request key makes client retries return the same
-- schedule instead of creating a second schedule or credit.
alter table public.income add column if not exists idempotency_key text;

create unique index if not exists income_schedule_idempotency_unique
  on public.income (user_id, idempotency_key)
  where idempotency_key is not null and is_recurring = true;

create or replace function public.create_income_schedule(
  owner_id uuid,
  wallet_id_value uuid,
  source_value text,
  type_value text,
  custom_type_value text,
  amount_value numeric,
  date_value date,
  frequency_value text,
  request_key text default null
)
returns public.income
language plpgsql
security definer
set search_path = public
as $$
declare
  schedule_row public.income%rowtype;
  posted_id uuid;
  scheduled_date date := date_value;
  due_today date := (now() at time zone 'Asia/Manila')::date;
  occurrence text;
begin
  if request_key is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(owner_id::text || ':' || trim(request_key), 0)
    );
    select * into schedule_row
      from public.income
      where user_id = owner_id and idempotency_key = trim(request_key)
        and is_recurring = true and deleted_at is null;
    if found then return schedule_row; end if;
  end if;

  if not exists (
    select 1 from public.wallets w
    where w.id = wallet_id_value and w.user_id = owner_id
      and coalesce(w.account_type, 'debit') <> 'credit'
  ) then
    raise exception 'income destination wallet is unavailable' using errcode = 'P0001';
  end if;

  -- A newly-created schedule must not backfill historical occurrences. Move
  -- a past anchor forward to its first future/today period instead.
  while scheduled_date < due_today loop
    scheduled_date := public.add_income_cycle(scheduled_date, frequency_value);
  end loop;

  insert into public.income (
    user_id, wallet_id, source, type, custom_type, amount, date,
    is_recurring, frequency, is_posted, schedule_status, schedule_anchor_date,
    source_type, received_at, idempotency_key
  ) values (
    owner_id, wallet_id_value, trim(source_value), type_value,
    nullif(trim(custom_type_value), ''), amount_value, scheduled_date,
    true, frequency_value, false, 'active', date_value,
    null, null, nullif(trim(request_key), '')
  ) returning * into schedule_row;

  if scheduled_date = due_today then
    occurrence := schedule_row.id::text || ':' || schedule_row.date::text;
    insert into public.income (
      user_id, wallet_id, source, type, custom_type, amount, date,
      is_recurring, frequency, is_posted, schedule_status, schedule_id,
      occurrence_key, source_type, received_at
    ) values (
      schedule_row.user_id, schedule_row.wallet_id, schedule_row.source,
      schedule_row.type, schedule_row.custom_type, schedule_row.amount,
      schedule_row.date, false, null, true, 'posted', schedule_row.id,
      occurrence, 'income_schedule', now()
    ) on conflict (occurrence_key) do nothing returning id into posted_id;

    update public.income
      set date = public.add_income_cycle(schedule_row.date, schedule_row.frequency),
          updated_at = now()
      where id = schedule_row.id
      returning * into schedule_row;
  end if;

  return schedule_row;
exception when unique_violation then
  if request_key is not null then
    select * into schedule_row from public.income
      where user_id = owner_id and idempotency_key = trim(request_key)
        and is_recurring = true and deleted_at is null;
    if found then return schedule_row; end if;
  end if;
  raise;
end;
$$;

revoke all on function public.create_income_schedule(uuid, uuid, text, text, text, numeric, date, text, text) from public;
grant execute on function public.create_income_schedule(uuid, uuid, text, text, text, numeric, date, text, text) to service_role;
