-- The create endpoint's recurring path must post a Manila-due occurrence in
-- the same transaction and remain idempotent on request retry.
begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_wallet_id uuid := gen_random_uuid();
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_schedule public.income%rowtype;
  v_retry public.income%rowtype;
  v_before numeric;
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values (v_user_id, 'authenticated', 'authenticated', v_user_id || '@example.test',
    '{"provider":"email","providers":["email"]}', '{}');
  insert into public.wallets (id, user_id, name, institution_type, institution_key, account_type)
  values (v_wallet_id, v_user_id, 'Due-today wallet', 'bank', 'test-bank', 'debit');
  v_before := (select balance from public.wallets where id = v_wallet_id);

  select * into v_schedule from public.create_income_schedule(
    v_user_id, v_wallet_id, 'Due today', 'salary', null, 4000, v_today,
    'monthly', 'income-due-today-test-0001'
  );
  select * into v_retry from public.create_income_schedule(
    v_user_id, v_wallet_id, 'Due today', 'salary', null, 4000, v_today,
    'monthly', 'income-due-today-test-0001'
  );

  if v_schedule.id <> v_retry.id
    or (select count(*) from public.income where user_id = v_user_id and idempotency_key = 'income-due-today-test-0001') <> 1
    or (select count(*) from public.income where schedule_id = v_schedule.id and is_posted = true) <> 1
    or (select balance from public.wallets where id = v_wallet_id) <> v_before + 4000 then
    raise exception 'Due-today recurring income was not atomically posted exactly once';
  end if;

  select * into v_schedule from public.create_income_schedule(
    v_user_id, v_wallet_id, 'Past start', 'salary', null, 2000, v_today - 10,
    'monthly', 'income-past-start-test-0001'
  );
  if v_schedule.is_posted or v_schedule.date <= v_today
    or (select count(*) from public.income where schedule_id = v_schedule.id and is_posted = true) <> 0 then
    raise exception 'Past recurring start incorrectly backfilled a historical occurrence';
  end if;
end;
$$;

rollback;
