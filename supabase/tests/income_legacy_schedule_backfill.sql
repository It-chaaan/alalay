-- Run after all migrations. Proves a legacy posted recurring row receives one
-- active schedule, projects its next month without a credit, and remains safe
-- when the scheduler is rerun. The transaction is always rolled back.
begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_wallet_id uuid := gen_random_uuid();
  v_legacy_id uuid := gen_random_uuid();
  v_schedule_id uuid;
  v_before numeric;
  v_first_run integer;
  v_second_run integer;
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values (
    v_user_id, 'authenticated', 'authenticated', v_user_id || '@example.test',
    '{"provider":"email","providers":["email"]}', '{"name":"Income backfill test"}'
  );
  insert into public.wallets (id, user_id, name, institution_type, institution_key, account_type)
  values (v_wallet_id, v_user_id, 'Backfill wallet', 'bank', 'test-bank', 'debit');

  -- This is the exact legacy shape found in production: a posted August row
  -- with recurrence metadata but no active schedule/source link.
  insert into public.income (
    id, user_id, wallet_id, source, type, amount, date, is_recurring, frequency,
    is_posted, schedule_status, source_type, received_at
  ) values (
    v_legacy_id, v_user_id, v_wallet_id, 'Legacy monthly income', 'salary', 1000,
    date '2026-08-31', true, 'monthly', true, 'posted', 'manual',
    timestamptz '2026-08-31 00:00:00+08'
  );
  v_before := (select balance from public.wallets where id = v_wallet_id);

  perform public.backfill_legacy_recurring_income_schedules(date '2026-08-31');
  select id into v_schedule_id from public.income
  where schedule_id = v_legacy_id and is_posted = false and schedule_status = 'active';
  if v_schedule_id is null
    or (select date from public.income where id = v_schedule_id) <> date '2026-09-30'
    or (select schedule_anchor_date from public.income where id = v_schedule_id) <> date '2026-08-31' then
    raise exception 'Legacy August 31 recurrence was not backfilled as September 30 active schedule';
  end if;
  if (select balance from public.wallets where id = v_wallet_id) <> v_before then
    raise exception 'Backfilling a schedule must not credit the wallet';
  end if;
  if public.backfill_legacy_recurring_income_schedules(date '2026-08-31') <> 0 then
    raise exception 'Legacy schedule backfill is not idempotent';
  end if;

  -- Make the generated schedule due, then verify one ledger occurrence and
  -- one balance credit; a retry must do neither again.
  update public.income set date = (now() at time zone 'Asia/Manila')::date where id = v_schedule_id;
  v_first_run := public.process_due_income_schedules();
  v_second_run := public.process_due_income_schedules();
  if v_first_run <> 1 or v_second_run <> 0 then
    raise exception 'Income scheduler did not post exactly one idempotent occurrence';
  end if;
  if (select count(*) from public.income where schedule_id = v_schedule_id and is_posted = true) <> 1
    or (select balance from public.wallets where id = v_wallet_id) <> v_before + 1000 then
    raise exception 'Due legacy recurrence did not create exactly one wallet credit';
  end if;
end;
$$;

rollback;
