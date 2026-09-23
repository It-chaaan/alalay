-- Run after all migrations. Verifies the scheduler's database transaction,
-- occurrence constraint, recurrence, owner isolation, and rollback behavior.
begin;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  wallet_a uuid := gen_random_uuid();
  wallet_b uuid := gen_random_uuid();
  wallet_invalid uuid := gen_random_uuid();
  schedule_a uuid := gen_random_uuid();
  schedule_b uuid := gen_random_uuid();
  schedule_invalid uuid := gen_random_uuid();
  schedule_skipped uuid := gen_random_uuid();
  first_run integer;
  second_run integer;
  third_run integer;
  before_failure_count integer;
  before_failure_date date;
  scheduler_raised boolean := false;
  credit_schedule_rejected boolean := false;
begin
  if (
    select count(*)
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'process_due_income_schedules'
  ) <> 1 or not exists (
    select 1
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'process_due_income_schedules'
      and pg_get_function_identity_arguments(p.oid) = 'target_schedule_id uuid, target_owner_id uuid'
      and p.pronargdefaults = 2
  ) then
    raise exception 'Income scheduler must have one canonical, defaulted production signature';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.income'::regclass
      and conname = 'income_occurrence_key_unique'
      and contype = 'u'
  ) then
    raise exception 'income_occurrence_key_unique must be a unique constraint';
  end if;

  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values
    (user_a, 'authenticated', 'authenticated', user_a || '@example.test', '{"provider":"email","providers":["email"]}', '{"name":"Scheduler A"}'),
    (user_b, 'authenticated', 'authenticated', user_b || '@example.test', '{"provider":"email","providers":["email"]}', '{"name":"Scheduler B"}');
  insert into public.wallets (id, user_id, name, institution_type, institution_key, account_type)
  values
    (wallet_a, user_a, 'Scheduler A wallet', 'bank', 'scheduler-a', 'debit'),
    (wallet_b, user_b, 'Scheduler B wallet', 'bank', 'scheduler-b', 'debit'),
    (wallet_invalid, user_a, 'Invalid scheduler wallet', 'bank', 'scheduler-invalid', 'debit');
  insert into public.income (
    id, user_id, wallet_id, source, type, amount, date, is_recurring, frequency,
    is_posted, schedule_status
  ) values
    (schedule_a, user_a, wallet_a, 'A salary', 'salary', 1000, (now() at time zone 'Asia/Manila')::date - 1, true, 'monthly', false, 'active'),
    (schedule_b, user_b, wallet_b, 'B salary', 'salary', 2000, (now() at time zone 'Asia/Manila')::date, false, null, false, 'active'),
    (schedule_invalid, user_a, wallet_invalid, 'Invalid salary', 'salary', 3000, (now() at time zone 'Asia/Manila')::date, false, null, false, 'active'),
    (schedule_skipped, user_a, wallet_a, 'Skipped salary', 'salary', 4000, (now() at time zone 'Asia/Manila')::date, false, null, false, 'active');
  insert into public.income_skipped_occurrences (user_id, source_id, occurrence_date)
  values (user_a, schedule_skipped, (now() at time zone 'Asia/Manila')::date);
  -- A wallet can be reclassified after a schedule exists. This must not make
  -- the invalid schedule block unrelated eligible income.
  update public.wallets set account_type = 'credit' where id = wallet_invalid;
  begin
    insert into public.income (
      user_id, wallet_id, source, type, amount, date, is_recurring, frequency,
      is_posted, schedule_status
    ) values (
      user_a, wallet_invalid, 'New invalid schedule', 'salary', 1,
      (now() at time zone 'Asia/Manila')::date, false, null, false, 'active'
    );
  exception when others then
    credit_schedule_rejected := sqlerrm = 'Credit cards cannot receive income';
  end;
  if not credit_schedule_rejected then
    raise exception 'A new income schedule targeting a credit wallet was accepted';
  end if;

  first_run := public.process_due_income_schedules(null::uuid, null::uuid);
  second_run := public.process_due_income_schedules();
  if first_run <> 2 or second_run <> 0 then
    raise exception 'scheduler first/retry results were %, % instead of 2, 0', first_run, second_run;
  end if;
  if (select count(*) from public.income where schedule_id = schedule_a and is_posted) <> 1
    or (select count(*) from public.income where schedule_id = schedule_b and is_posted) <> 1
    or (select count(*) from public.income where schedule_id = schedule_invalid and is_posted) <> 0
    or (select count(*) from public.income where schedule_id = schedule_skipped and is_posted) <> 0
    or (select schedule_status from public.income where id = schedule_skipped) <> 'completed'
    or (select posting_status from public.income where id = schedule_invalid) <> 'failed'
    or (select balance from public.wallets where id = wallet_a) <> 1000
    or (select balance from public.wallets where id = wallet_b) <> 2000 then
    raise exception 'scheduler did not create one occurrence and one credit per schedule';
  end if;

  -- A new due date for the same recurring schedule is a new occurrence key.
  update public.income
  set date = (now() at time zone 'Asia/Manila')::date
  where id = schedule_a;
  third_run := public.process_due_income_schedules();
  if third_run <> 1
    or (select count(*) from public.income where schedule_id = schedule_a and is_posted) <> 2
    or (select balance from public.wallets where id = wallet_a) <> 2000 then
    raise exception 'second recurring occurrence was not independently posted exactly once';
  end if;

  -- A duplicate occurrence key is rejected by the actual table constraint.
  begin
    insert into public.income (
      user_id, wallet_id, source, type, amount, date, is_recurring,
      is_posted, schedule_status, schedule_id, occurrence_key, source_type, received_at
    )
    select user_id, wallet_id, source, type, amount, date, false,
           true, 'posted', schedule_id, occurrence_key, 'income_schedule', now()
    from public.income
    where schedule_id = schedule_a and is_posted
    order by created_at
    limit 1;
    raise exception 'duplicate occurrence key was accepted';
  exception when unique_violation then null;
  end;

  -- Force a ledger insert failure after the function has locked the schedule.
  -- The RPC must roll back both its inserted occurrence and schedule advance.
  update public.income
  set date = (now() at time zone 'Asia/Manila')::date - 2
  where id = schedule_a;
  select count(*) into before_failure_count
  from public.income where schedule_id = schedule_a and is_posted;
  select date into before_failure_date from public.income where id = schedule_a;
  create function pg_temp.reject_income_scheduler_insert()
  returns trigger language plpgsql as $trigger$
  begin
    raise exception 'forced scheduler failure';
  end;
  $trigger$;
  create trigger test_reject_income_scheduler_insert
  before insert on public.income
  for each row execute function pg_temp.reject_income_scheduler_insert();
  begin
    perform public.process_due_income_schedules();
  exception when others then scheduler_raised := true;
  end;
  drop trigger test_reject_income_scheduler_insert on public.income;
  if scheduler_raised
    or (select count(*) from public.income where schedule_id = schedule_a and is_posted) <> before_failure_count
    or (select date from public.income where id = schedule_a) <> before_failure_date
    or (select posting_status from public.income where id = schedule_a) <> 'failed'
    or (select balance from public.wallets where id = wallet_a) <> 2000 then
    raise exception 'scheduler failure was not isolated without partial financial changes';
  end if;
end;
$$;

rollback;
