-- The skipped-occurrence migration accidentally recreated the historical
-- zero-argument scheduler beside the targeted scheduler whose two arguments
-- both have defaults. A no-argument call was therefore ambiguous, and the old
-- body also omitted the current posting contract and per-schedule isolation.
drop function if exists public.process_due_income_schedules();

create or replace function public.process_due_income_schedules(
  target_schedule_id uuid default null,
  target_owner_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  schedule_row public.income%rowtype;
  posted_id uuid;
  occurrence text;
  due_today date := (now() at time zone 'Asia/Manila')::date;
  processed integer := 0;
  posted_at timestamptz := now();
  failure_code text;
begin
  for schedule_row in
    select i.*
    from public.income as i
    where i.is_posted = false
      and i.schedule_status = 'active'
      and i.deleted_at is null
      and i.date <= due_today
      and (target_schedule_id is null or i.id = target_schedule_id)
      and (target_owner_id is null or i.user_id = target_owner_id)
    order by i.date, i.id
    for update skip locked
  loop
    loop
      begin
        occurrence := schedule_row.id::text || ':' || schedule_row.date::text;
        posted_id := null;

        if not exists (
          select 1
          from public.income_skipped_occurrences as skipped
          where skipped.user_id = schedule_row.user_id
            and skipped.source_id = schedule_row.id
            and skipped.occurrence_date = schedule_row.date
        ) then
          if not exists (
            select 1
            from public.wallets as wallet
            where wallet.id = schedule_row.wallet_id
              and wallet.user_id = schedule_row.user_id
              and coalesce(wallet.account_type, 'debit') <> 'credit'
          ) then
            raise exception 'income destination wallet is unavailable' using errcode = 'P0001';
          end if;

          insert into public.income (
            user_id, wallet_id, source, type, custom_type, amount, date,
            is_recurring, frequency, is_posted, schedule_status, schedule_id,
            occurrence_key, source_type, received_at
          ) values (
            schedule_row.user_id, schedule_row.wallet_id, schedule_row.source,
            schedule_row.type, schedule_row.custom_type, schedule_row.amount,
            schedule_row.date, false, null, true, 'posted', schedule_row.id,
            occurrence, 'income_schedule', posted_at
          )
          on conflict (occurrence_key) do nothing
          returning id into posted_id;

        end if;

        if not coalesce(schedule_row.is_recurring, false) then
          update public.income as income_schedule
          set schedule_status = 'completed',
              posting_status = null,
              posting_error_code = null,
              updated_at = posted_at
          where income_schedule.id = schedule_row.id;
          if posted_id is not null then
            processed := processed + 1;
          end if;
          exit;
        end if;

        update public.income as income_schedule
        set date = public.add_income_cycle(schedule_row.date, schedule_row.frequency),
            posting_status = null,
            posting_error_code = null,
            updated_at = posted_at
        where income_schedule.id = schedule_row.id
        returning income_schedule.* into schedule_row;
        if posted_id is not null then
          processed := processed + 1;
        end if;
        exit when schedule_row.date > due_today;
      exception when others then
        get stacked diagnostics failure_code = returned_sqlstate;
        update public.income as failed_schedule
        set posting_status = 'failed',
            posting_error_code = failure_code,
            updated_at = now()
        where failed_schedule.id = schedule_row.id;
        exit;
      end;
    end loop;
  end loop;

  return processed;
end;
$$;

revoke all on function public.process_due_income_schedules(uuid, uuid) from public;
grant execute on function public.process_due_income_schedules(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
