-- Reconcile one confirmed split profile only when the production state matches
-- the reviewed incident exactly. auth.users.id is the identity authority.
begin;

do $$
declare
  auth_id constant uuid := 'd1c42961-11b2-4cdf-a8c0-aa6f5fa65b58';
  stale_id constant uuid := '3ce04d2c-648d-40fe-9206-f012ac56bc48';
  auth_email text;
  auth_exists boolean;
  authoritative_exists boolean;
  stale_exists boolean;
  stale_auth_exists boolean;
  stale_email text;
  child record;
  child_count bigint;
begin
  select exists(select 1 from auth.users where id = auth_id),
         (select lower(nullif(trim(email), '')) from auth.users where id = auth_id)
    into auth_exists, auth_email
  from auth.users
  where id = auth_id;

  select exists(select 1 from public.users where id = auth_id),
         exists(select 1 from public.users where id = stale_id),
         exists(select 1 from auth.users where id = stale_id)
    into authoritative_exists, stale_exists, stale_auth_exists;

  -- A clean local database has no incident rows; leave it untouched. Any
  -- partial production match is unsafe and must be reviewed manually.
  if not auth_exists and not authoritative_exists and not stale_exists then
    raise notice 'Auth profile reconciliation skipped: reviewed incident is absent.';
    return;
  end if;

  if not auth_exists or not authoritative_exists or not stale_exists then
    raise exception 'Auth profile reconciliation aborted: expected Auth and both public.users rows were not found';
  end if;
  if stale_auth_exists then
    raise exception 'Auth profile reconciliation aborted: stale UUID also exists in auth.users';
  end if;
  if auth_email is null then
    raise exception 'Auth profile reconciliation aborted: authoritative Auth email is null';
  end if;

  select lower(nullif(trim(email), '')) into stale_email
  from public.users where id = stale_id;
  if stale_email is distinct from auth_email then
    raise exception 'Auth profile reconciliation aborted: stale profile email does not match authoritative Auth email';
  end if;
  if exists(select 1 from public.users where id = auth_id and email is not null) then
    raise exception 'Auth profile reconciliation aborted: authoritative profile email is not null';
  end if;
  if (select count(*) from public.users where lower(nullif(trim(email), '')) = auth_email) <> 1 then
    raise exception 'Auth profile reconciliation aborted: normalized email is not unique';
  end if;

  raise notice 'Reviewed profile before reconciliation: %',
    (select row_to_json(profile) from public.users profile where profile.id = stale_id);
  raise notice 'Authoritative profile before reconciliation: %',
    (select row_to_json(profile) from public.users profile where profile.id = auth_id);

  -- Enumerate every FK to public.users and refuse to guess how to merge child
  -- records. The confirmed incident is profile-only; any child row changes the
  -- reviewed scope and requires a new business-rule-specific reconciliation.
  for child in
    select n.nspname as schema_name, c.relname as table_name, a.attname as column_name
    from pg_constraint fk
    join pg_class c on c.oid = fk.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join unnest(fk.conkey) with ordinality key(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.oid and a.attnum = key.attnum
    where fk.contype = 'f'
      and fk.confrelid = 'public.users'::regclass
      and array_length(fk.conkey, 1) = 1
      and n.nspname = 'public'
  loop
    execute format('select count(*) from %I.%I where %I = $1', child.schema_name, child.table_name, child.column_name)
      into child_count using stale_id;
    raise notice 'Stale UUID child reference %.%(%): %', child.schema_name, child.table_name, child.column_name, child_count;
    if child_count > 0 then
      raise exception 'Auth profile reconciliation aborted: stale UUID has child rows in %.%(%)', child.schema_name, child.table_name, child.column_name;
    end if;
  end loop;

  -- Preserve existing authoritative values; only fill missing profile fields
  -- from the reviewed stale row and always take the normalized Auth email.
  update public.users authoritative
  set name = coalesce(nullif(trim(authoritative.name), ''), stale.name),
      email = auth_email,
      avatar_url = coalesce(authoritative.avatar_url, stale.avatar_url),
      phone = coalesce(authoritative.phone, stale.phone),
      currency = coalesce(authoritative.currency, stale.currency),
      language = coalesce(authoritative.language, stale.language),
      plan = coalesce(authoritative.plan, stale.plan),
      income = coalesce(authoritative.income, stale.income),
      pay_schedule = coalesce(authoritative.pay_schedule, stale.pay_schedule),
      health_score = coalesce(authoritative.health_score, stale.health_score),
      onboarding_done = coalesce(authoritative.onboarding_done, stale.onboarding_done),
      deleted_at = coalesce(authoritative.deleted_at, stale.deleted_at),
      updated_at = now()
  from public.users stale
  where authoritative.id = auth_id and stale.id = stale_id;

  delete from public.users where id = stale_id;

  if exists(select 1 from public.users where id = stale_id)
     or not exists(select 1 from public.users where id = auth_id and email = auth_email)
  then
    raise exception 'Auth profile reconciliation failed its postcondition';
  end if;
end;
$$;

-- Future Auth inserts must create/update only NEW.id. Email conflicts are
-- genuine identity conflicts and intentionally fail instead of merging rows.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(nullif(trim(new.email), ''));
  profile_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(normalized_email, ''), '@', 1), '')
  );
  provider_avatar text := coalesce(new.raw_user_meta_data->>'picture', new.raw_user_meta_data->>'avatar_url');
begin
  if provider_avatar is not null and exists(select 1 from public.users where avatar_url = provider_avatar and id <> new.id) then
    provider_avatar := null;
  end if;

  insert into public.users (id, name, email, avatar_url)
  values (new.id, profile_name, normalized_email, provider_avatar)
  on conflict (id) do update
    set name = coalesce(public.users.name, excluded.name),
        email = coalesce(public.users.email, excluded.email),
        avatar_url = coalesce(public.users.avatar_url, excluded.avatar_url),
        updated_at = now();

  perform public.ensure_default_cash_wallet(new.id);
  return new;
end;
$$;

commit;
