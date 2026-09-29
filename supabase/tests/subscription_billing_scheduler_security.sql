-- Service-role scheduling, authenticated ownership, and billing idempotency.
-- The transaction is always rolled back by this file.
begin;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  wallet_a uuid := gen_random_uuid();
  wallet_b uuid := gen_random_uuid();
  subscription_a uuid := gen_random_uuid();
  subscription_b uuid := gen_random_uuid();
  user_a_second_subscription uuid := gen_random_uuid();
  anonymous_rejected boolean := false;
  cross_user_rejected boolean := false;
begin
  if has_function_privilege(
      'anon',
      'public.process_subscription_billing_occurrences(uuid,date)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.process_subscription_billing_occurrences(uuid,date)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.process_subscription_billing_occurrences(uuid,date)',
      'EXECUTE'
    )
    or not coalesce((
      select rpc.prosecdef
        and rpc.proconfig @> array['search_path=public']::text[]
      from pg_proc as rpc
      join pg_namespace as rpc_namespace on rpc_namespace.oid = rpc.pronamespace
      where rpc_namespace.nspname = 'public'
        and rpc.proname = 'process_subscription_billing_occurrences'
        and pg_get_function_identity_arguments(rpc.oid) = 'target_user_id uuid, target_through date'
    ), false) then
    raise exception 'Subscription billing RPC privileges are unsafe';
  end if;

  perform pg_temp.create_supabase_test_user(
    user_a,
    user_a || '@example.test',
    '{"name":"Subscription Scheduler A"}'
  );
  perform pg_temp.create_supabase_test_user(
    user_b,
    user_b || '@example.test',
    '{"name":"Subscription Scheduler B"}'
  );

  insert into public.wallets (
    id,
    user_id,
    name,
    institution_type,
    institution_key,
    account_type
  ) values
    (wallet_a, user_a, 'Scheduler A Wallet', 'bank', 'scheduler-a', 'debit'),
    (wallet_b, user_b, 'Scheduler B Wallet', 'bank', 'scheduler-b', 'debit');

  insert into public.subscriptions (
    id,
    user_id,
    wallet_id,
    name,
    amount,
    renewal_date,
    billing_cycle,
    auto_renew
  ) values
    (
      subscription_a,
      user_a,
      wallet_a,
      'Scheduler A Subscription',
      101,
      date '2026-09-01',
      'monthly',
      true
    ),
    (
      subscription_b,
      user_b,
      wallet_b,
      'Scheduler B Subscription',
      202,
      date '2026-09-01',
      'monthly',
      true
    );

  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform public.process_subscription_billing_occurrences(null, date '2026-09-01');
  perform set_config('role', 'postgres', true);

  if (select count(*) from public.subscription_occurrences
      where subscription_id in (subscription_a, subscription_b)) <> 2
    or (select count(*) from public.expenses
      where subscription_id in (subscription_a, subscription_b)
        and generated_by = 'subscription'
        and deleted_at is null) <> 2 then
    raise exception 'Service-role all-user billing did not process both owners exactly once';
  end if;

  perform set_config('role', 'service_role', true);
  perform public.process_subscription_billing_occurrences(null, date '2026-09-01');
  perform set_config('role', 'postgres', true);

  if (select count(*) from public.subscription_occurrences
      where subscription_id in (subscription_a, subscription_b)) <> 2
    or (select count(*) from public.expenses
      where subscription_id in (subscription_a, subscription_b)
        and generated_by = 'subscription'
        and deleted_at is null) <> 2 then
    raise exception 'Immediate service-role rerun created duplicate billing records';
  end if;

  insert into public.subscriptions (
    id,
    user_id,
    wallet_id,
    name,
    amount,
    renewal_date,
    billing_cycle,
    auto_renew
  ) values (
    user_a_second_subscription,
    user_a,
    wallet_a,
    'User-scoped Subscription',
    303,
    date '2026-09-02',
    'monthly',
    true
  );

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', user_a::text, true);

  begin
    perform public.process_subscription_billing_occurrences(user_b, date '2026-09-02');
  exception when others then
    cross_user_rejected := sqlerrm = 'not authorized';
  end;
  if not cross_user_rejected then
    raise exception 'Authenticated cross-user subscription billing was accepted';
  end if;

  -- A null target for an authenticated user resolves only to that user.
  perform public.process_subscription_billing_occurrences(null, date '2026-09-02');
  perform set_config('role', 'postgres', true);

  if (select count(*) from public.subscription_occurrences
      where subscription_id = user_a_second_subscription) <> 1
    or (select count(*) from public.expenses
      where subscription_id = user_a_second_subscription
        and generated_by = 'subscription'
        and deleted_at is null) <> 1 then
    raise exception 'Valid user-scoped subscription billing did not create one occurrence';
  end if;

  -- Anonymous callers have no EXECUTE privilege. Checking the effective ACL
  -- avoids a PostgreSQL 17/PostgREST privilege-denial crash seen in some local
  -- images when invoking a revoked SECURITY DEFINER function directly.
  anonymous_rejected := not has_function_privilege(
    'anon',
    'public.process_subscription_billing_occurrences(uuid,date)',
    'EXECUTE'
  );
  if not anonymous_rejected then
    raise exception 'Anonymous subscription billing RPC access was accepted';
  end if;
end;
$$;

rollback;
