-- A user-initiated recovery path must run precisely the same database posting
-- routine as the durable scheduler.  Optional target arguments preserve the
-- existing scheduler call while allowing a service to safely retry one owned
-- schedule after it has been verified at the API boundary.
drop function if exists public.process_due_income_schedules();

create function public.process_due_income_schedules(
  target_schedule_id uuid default null,
  target_owner_id uuid default null
)
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
  failure_code text;
begin
  for schedule_row in
    select * from public.income
    where is_posted = false
      and schedule_status = 'active'
      and deleted_at is null
      and date <= due_today
      and (target_schedule_id is null or id = target_schedule_id)
      and (target_owner_id is null or user_id = target_owner_id)
    order by date, id
    for update skip locked
  loop
    loop
      begin
        if not exists (
          select 1 from public.wallets w
          where w.id = schedule_row.wallet_id
            and w.user_id = schedule_row.user_id
            and coalesce(w.account_type, 'debit') <> 'credit'
        ) then
          raise exception 'income destination wallet is unavailable' using errcode = 'P0001';
        end if;

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
          update public.income
          set schedule_status = 'completed', posting_status = null,
              posting_error_code = null, updated_at = posted_at
          where id = schedule_row.id;
          exit;
        end if;

        update public.income
        set date = public.add_income_cycle(schedule_row.date, schedule_row.frequency),
            posting_status = null, posting_error_code = null, updated_at = posted_at
        where id = schedule_row.id
        returning * into schedule_row;
        exit when schedule_row.date > due_today;
      exception when others then
        get stacked diagnostics failure_code = returned_sqlstate;
        update public.income
        set posting_status = 'failed', posting_error_code = failure_code, updated_at = now()
        where id = schedule_row.id;
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
