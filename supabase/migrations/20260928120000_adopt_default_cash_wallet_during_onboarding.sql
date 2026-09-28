-- The Auth profile trigger creates the owner's default Cash wallet before
-- first-run onboarding. Adopt that wallet atomically instead of attempting to
-- insert a second row protected by wallets_one_default_cash_per_user.
create or replace function public.complete_first_run_onboarding(
  nickname_value text, wallet_name_value text, opening_amount numeric, operation_id uuid
) returns public.wallets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  owner_id uuid := auth.uid();
  profile public.users;
  result public.wallets;
begin
  if owner_id is null then
    raise exception 'Authentication is required';
  end if;
  if nickname_value is null
    or length(btrim(nickname_value)) = 0
    or char_length(btrim(nickname_value)) > 80 then
    raise exception 'Enter the name you want Alalay to use';
  end if;
  if wallet_name_value is null
    or length(btrim(wallet_name_value)) = 0
    or char_length(btrim(wallet_name_value)) > 120 then
    raise exception 'Enter a wallet name';
  end if;
  if opening_amount is null
    or opening_amount < 0
    or opening_amount <> trunc(opening_amount, 2) then
    raise exception 'Cash balance must be a non-negative currency amount';
  end if;
  if operation_id is null then
    raise exception 'Onboarding operation is required';
  end if;

  -- Serialize every onboarding attempt for this owner. A waiter observes the
  -- committed onboarding_done value and takes the idempotent return path.
  select * into profile
  from public.users
  where id = owner_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if profile.onboarding_done then
    select * into result
    from public.wallets
    where user_id = owner_id
      and onboarding_operation_id = operation_id;

    if not found then
      select * into result
      from public.wallets
      where user_id = owner_id
        and created_from = 'first_run'
      order by created_at, id
      limit 1;
    end if;

    if found then
      return result;
    end if;
    raise exception 'Onboarding has already been completed';
  end if;

  insert into public.wallets (
    user_id,
    name,
    institution_type,
    institution_key,
    currency,
    color,
    is_default_cash,
    onboarding_operation_id,
    created_from
  ) values (
    owner_id,
    btrim(wallet_name_value),
    'cash',
    'cash',
    'PHP',
    '#0F8A6B',
    true,
    operation_id,
    'first_run'
  )
  on conflict (user_id) where is_default_cash
  do update set
    name = excluded.name,
    institution_type = excluded.institution_type,
    institution_key = excluded.institution_key,
    currency = excluded.currency,
    color = excluded.color,
    onboarding_operation_id = excluded.onboarding_operation_id,
    created_from = excluded.created_from
  returning * into result;

  if opening_amount > 0 then
    insert into public.wallet_adjustments (user_id, wallet_id, amount, date, note)
    values (
      owner_id,
      result.id,
      opening_amount,
      (now() at time zone 'Asia/Manila')::date,
      'Opening balance'
    );
  end if;

  update public.users
  set nickname = btrim(nickname_value),
      onboarding_done = true,
      onboarding_version = 1,
      onboarding_completed_at = clock_timestamp()
  where id = owner_id;

  select * into result
  from public.wallets
  where id = result.id
    and user_id = owner_id;
  return result;
end;
$$;

revoke all on function public.complete_first_run_onboarding(text,text,numeric,uuid) from public;
grant execute on function public.complete_first_run_onboarding(text,text,numeric,uuid) to authenticated;

notify pgrst, 'reload schema';
