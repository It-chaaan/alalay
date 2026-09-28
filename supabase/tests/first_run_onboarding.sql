-- First-run onboarding must adopt the Auth-trigger-created Cash wallet without
-- duplicating it or applying its opening-balance ledger entry more than once.
begin;

do $$
declare
  fresh_user uuid := gen_random_uuid();
  no_wallet_user uuid := gen_random_uuid();
  completed_user uuid := gen_random_uuid();
  other_user uuid := gen_random_uuid();
  fresh_operation uuid := gen_random_uuid();
  duplicate_operation uuid := gen_random_uuid();
  no_wallet_operation uuid := gen_random_uuid();
  completed_operation uuid := gen_random_uuid();
  other_operation uuid := gen_random_uuid();
  fresh_wallet_before uuid;
  fresh_wallet_after uuid;
  retry_wallet uuid;
  no_wallet_result uuid;
  other_wallet_before public.wallets;
  rejected boolean;
begin
  perform pg_temp.create_supabase_test_user(
    fresh_user,
    'first-run-fresh@example.test',
    '{"name":"Fresh owner"}'
  );

  select id into fresh_wallet_before
  from public.wallets
  where user_id = fresh_user and is_default_cash;

  if fresh_wallet_before is null
    or (select count(*) from public.wallets where user_id = fresh_user and is_default_cash) <> 1 then
    raise exception 'Fresh registration did not create exactly one default Cash wallet';
  end if;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', fresh_user::text, true);

  select id into fresh_wallet_after
  from public.complete_first_run_onboarding(
    '  Fresh nickname  ',
    '  Pocket Cash  ',
    123.45,
    fresh_operation
  );

  if fresh_wallet_after is distinct from fresh_wallet_before then
    raise exception 'Onboarding replaced the Auth-trigger-created wallet instead of adopting it';
  end if;
  if not exists (
    select 1
    from public.users
    where id = fresh_user
      and nickname = 'Fresh nickname'
      and onboarding_done
      and onboarding_completed_at is not null
  ) then
    raise exception 'Onboarding did not persist the normalized nickname or completion state';
  end if;
  if not exists (
    select 1
    from public.wallets
    where id = fresh_wallet_before
      and user_id = fresh_user
      and name = 'Pocket Cash'
      and institution_type = 'cash'
      and institution_key = 'cash'
      and currency = 'PHP'
      and is_default_cash
      and onboarding_operation_id = fresh_operation
      and created_from = 'first_run'
      and balance = 123.45
  ) then
    raise exception 'Onboarding did not apply the intended wallet values and opening balance';
  end if;
  if (select count(*) from public.wallet_adjustments
      where user_id = fresh_user and wallet_id = fresh_wallet_before and note = 'Opening balance') <> 1 then
    raise exception 'Opening balance did not create exactly one ledger adjustment';
  end if;

  -- A same-operation retry returns the original wallet and does not post the
  -- opening balance a second time, even if the repeated payload differs.
  select id into retry_wallet
  from public.complete_first_run_onboarding(
    'Changed nickname',
    'Changed wallet',
    999.99,
    fresh_operation
  );
  if retry_wallet is distinct from fresh_wallet_before
    or (select balance from public.wallets where id = fresh_wallet_before) <> 123.45
    or (select nickname from public.users where id = fresh_user) <> 'Fresh nickname'
    or (select count(*) from public.wallet_adjustments
        where user_id = fresh_user and wallet_id = fresh_wallet_before and note = 'Opening balance') <> 1 then
    raise exception 'Same-operation retry changed the completed onboarding result';
  end if;

  -- A double submission carrying a different operation ID must return the
  -- first successful wallet without resetting any completed state.
  select id into retry_wallet
  from public.complete_first_run_onboarding(
    'Duplicate nickname',
    'Duplicate wallet',
    777.77,
    duplicate_operation
  );
  if retry_wallet is distinct from fresh_wallet_before
    or (select balance from public.wallets where id = fresh_wallet_before) <> 123.45
    or (select onboarding_operation_id from public.wallets where id = fresh_wallet_before) <> fresh_operation
    or (select count(*) from public.wallets where user_id = fresh_user and is_default_cash) <> 1 then
    raise exception 'Different-operation duplicate reset or duplicated completed onboarding';
  end if;

  -- A recoverable legacy/existing profile with no wallet gets one safe default
  -- wallet through the same RPC.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.create_supabase_test_user(
    no_wallet_user,
    'first-run-no-wallet@example.test',
    '{"name":"No wallet owner"}'
  );
  delete from public.wallets where user_id = no_wallet_user;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', no_wallet_user::text, true);
  select id into no_wallet_result
  from public.complete_first_run_onboarding(
    'Recovered owner',
    'Recovered Cash',
    50.00,
    no_wallet_operation
  );
  if no_wallet_result is null
    or (select count(*) from public.wallets where user_id = no_wallet_user and is_default_cash) <> 1
    or (select balance from public.wallets where id = no_wallet_result) <> 50.00 then
    raise exception 'Onboarding did not safely create the missing default wallet';
  end if;

  -- A grandfathered completed account with no first-run result remains
  -- immutable and receives the established already-completed error.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.create_supabase_test_user(
    completed_user,
    'first-run-completed@example.test',
    '{"name":"Completed owner"}'
  );
  update public.users
  set nickname = 'Existing nickname',
      onboarding_done = true,
      onboarding_completed_at = now()
  where id = completed_user;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', completed_user::text, true);
  rejected := false;
  begin
    perform public.complete_first_run_onboarding(
      'Replacement nickname',
      'Replacement Cash',
      900.00,
      completed_operation
    );
  exception when others then
    rejected := sqlerrm = 'Onboarding has already been completed';
  end;
  if not rejected
    or (select nickname from public.users where id = completed_user) <> 'Existing nickname'
    or (select balance from public.wallets where user_id = completed_user and is_default_cash) <> 0 then
    raise exception 'Completed account was not rejected without mutation';
  end if;

  -- User B can onboard only User B. User A's profile and wallet must remain
  -- unchanged because the RPC accepts no target owner and uses auth.uid().
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.create_supabase_test_user(
    other_user,
    'first-run-other@example.test',
    '{"name":"Other owner"}'
  );
  select * into other_wallet_before
  from public.wallets
  where user_id = fresh_user and is_default_cash;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', other_user::text, true);
  perform public.complete_first_run_onboarding(
    'Other nickname',
    'Other Cash',
    25.00,
    other_operation
  );

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  if not exists (
    select 1
    from public.wallets
    where id = other_wallet_before.id
      and user_id = fresh_user
      and name is not distinct from other_wallet_before.name
      and balance is not distinct from other_wallet_before.balance
      and onboarding_operation_id is not distinct from other_wallet_before.onboarding_operation_id
  )
    or (select nickname from public.users where id = fresh_user) <> 'Fresh nickname' then
    raise exception 'User B modified User A onboarding state or default wallet';
  end if;

  -- Anonymous callers cannot complete onboarding.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claim.sub', '', true);
  rejected := false;
  begin
    perform public.complete_first_run_onboarding(
      'Anonymous',
      'Anonymous Cash',
      1.00,
      gen_random_uuid()
    );
  exception when others then
    rejected := sqlerrm = 'Authentication is required';
  end;
  if not rejected then
    raise exception 'Anonymous onboarding attempt was not rejected';
  end if;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  if exists (
    select user_id
    from public.wallets
    where user_id in (fresh_user, no_wallet_user, completed_user, other_user)
      and is_default_cash
    group by user_id
    having count(*) <> 1
  ) then
    raise exception 'A tested owner has more than one default Cash wallet';
  end if;
end;
$$;

rollback;
