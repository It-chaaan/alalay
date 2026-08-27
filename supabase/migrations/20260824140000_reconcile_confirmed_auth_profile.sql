-- Incident-specific identity reconciliation.
--
-- Production stopped while this migration was being applied because the
-- reviewed stale profile owns child rows. The failed transaction must roll
-- back; this migration deliberately reconciles those rows instead of
-- deleting the profile or skipping migration history.
--
-- Supabase Auth is authoritative. The UUIDs are intentionally fixed to the
-- reviewed incident and are not client inputs.
begin;

create or replace function public.reconcile_auth_profile(auth_id uuid, stale_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  auth_email text;
  stale_email text;
  auth_exists boolean;
  authoritative_exists boolean;
  stale_exists boolean;
  stale_auth_exists boolean;
  child record;
  child_count bigint;
  has_stale_array_value boolean;
  unique_index record;
  owner_attnum smallint;
  match_sql text;
  predicate_sql text;
  stale_matches_index boolean;
  auth_matches_index boolean;
  unique_conflict boolean;
begin
  -- Serialize this reviewed reconciliation and block application writes that
  -- could add another stale-owned row while the graph is being transferred.
  perform pg_advisory_xact_lock(hashtextextended('alalay.auth-profile-reconciliation', 0));
  lock table public.users in share row exclusive mode;

  select exists(select 1 from auth.users where id = auth_id),
         exists(select 1 from public.users where id = auth_id),
         exists(select 1 from public.users where id = stale_id),
         exists(select 1 from auth.users where id = stale_id)
    into auth_exists, authoritative_exists, stale_exists, stale_auth_exists;

  -- Clean databases and already-reconciled databases are safe no-ops.
  if not auth_exists and not authoritative_exists and not stale_exists and not stale_auth_exists then
    raise notice 'Auth profile reconciliation skipped: reviewed incident is absent.';
    return;
  end if;
  if auth_exists and authoritative_exists and not stale_exists and not stale_auth_exists then
    raise notice 'Auth profile reconciliation skipped: reviewed incident is already reconciled.';
    return;
  end if;

  if not auth_exists or not authoritative_exists or not stale_exists then
    raise exception 'Auth profile reconciliation aborted: expected Auth and both public profile rows were not found';
  end if;
  if stale_auth_exists then
    raise exception 'Auth profile reconciliation aborted: stale UUID also exists in auth.users';
  end if;

  select lower(nullif(trim(email), '')) into auth_email
  from auth.users where id = auth_id;
  select lower(nullif(trim(email), '')) into stale_email
  from public.users where id = stale_id;

  if auth_email is null or stale_email is null or auth_email is distinct from stale_email then
    raise exception 'Auth profile reconciliation aborted: identity evidence does not match';
  end if;
  if exists(select 1 from public.users where id = auth_id and email is not null) then
    raise exception 'Auth profile reconciliation aborted: authoritative profile email is not null';
  end if;
  if (select count(*) from public.users where lower(nullif(trim(email), '')) = auth_email) <> 1 then
    raise exception 'Auth profile reconciliation aborted: normalized identity evidence is not unique';
  end if;

  -- Lock every direct child table in a stable order before counting or
  -- updating. This prevents concurrent ownership changes during the repair.
  for child in
    select distinct n.nspname as schema_name, c.relname as table_name
    from pg_constraint fk
    join pg_class c on c.oid = fk.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where fk.contype = 'f'
      and fk.confrelid = 'public.users'::regclass
      and n.nspname = 'public'
    order by n.nspname, c.relname
  loop
    execute format('lock table %I.%I in share row exclusive mode', child.schema_name, child.table_name);
  end loop;

  -- Both reviewed profiles have a default cash wallet. The authoritative
  -- wallet remains the user's default; preserve the stale wallet record but
  -- demote only its default flag before changing its owner. This resolves the
  -- known partial-unique-index collision without deleting financial data.
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'wallets'
  ) then
    update public.wallets
    set is_default_cash = false
    where user_id = stale_id and is_default_cash;
  end if;

  -- A unique key containing an ownership column can make reassignment
  -- ambiguous (for example, two preference rows for the same user). Abort
  -- rather than silently choosing or deleting one of the records.
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
    order by n.nspname, c.relname, a.attname
  loop
    execute format('select count(*) from %I.%I where %I = $1', child.schema_name, child.table_name, child.column_name)
      into child_count using stale_id;
    if child_count = 0 then continue; end if;

    select a2.attnum
      into owner_attnum
    from pg_attribute a2
    where a2.attrelid = format('%I.%I', child.schema_name, child.table_name)::regclass
      and a2.attname = child.column_name;

    for unique_index in
      select i.indexrelid, i.indkey, i.indpred, i.indrelid
      from pg_index i
      where i.indrelid = format('%I.%I', child.schema_name, child.table_name)::regclass
        and i.indisunique
        and owner_attnum = any(i.indkey)
    loop
      -- Expression indexes cannot be safely reconstructed here; fail closed
      -- instead of guessing how an ownership transfer affects them.
      if 0 = any(unique_index.indkey) then
        raise exception 'Auth profile reconciliation aborted: unsupported expression unique index on %.%', child.schema_name, child.table_name;
      end if;

      select coalesce(string_agg(
        format('a.%I is not distinct from s.%I', a3.attname, a3.attname),
        ' and ' order by u.ord
      ), 'true')
        into match_sql
      from unnest(unique_index.indkey) with ordinality u(attnum, ord)
      join pg_attribute a3
        on a3.attrelid = unique_index.indrelid and a3.attnum = u.attnum
      where u.attnum <> owner_attnum;

      predicate_sql := coalesce(pg_get_expr(unique_index.indpred, unique_index.indrelid), 'true');

      execute format(
        'select exists(select 1 from %I.%I s where s.%I = $1 and (%s))',
        child.schema_name, child.table_name, child.column_name, predicate_sql
      ) into stale_matches_index using stale_id;

      if not stale_matches_index then
        continue;
      end if;

      execute format(
        'select exists(select 1 from %I.%I a where a.%I = $1 and (%s))',
        child.schema_name, child.table_name, child.column_name, predicate_sql
      ) into auth_matches_index using auth_id;

      if not auth_matches_index then
        continue;
      end if;

      execute format(
        'select exists(select 1 from %I.%I s join %I.%I a on a.%I = $1 and s.%I = $2 and (%s))',
        child.schema_name, child.table_name,
        child.schema_name, child.table_name,
        child.column_name, child.column_name, match_sql
      ) into unique_conflict using auth_id, stale_id;

      if unique_conflict then
        raise exception 'Auth profile reconciliation aborted: unique ownership conflict in %.%(%)', child.schema_name, child.table_name, child.column_name;
      end if;
    end loop;
  end loop;

  -- Transfer direct FK ownership without changing primary keys or business
  -- values. Wallets are first so wallet-owner validation triggers continue to
  -- see a wallet owned by the new authoritative UUID.
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
    order by case when c.relname = 'wallets' then 0 else 1 end, n.nspname, c.relname, a.attname
  loop
    execute format('update %I.%I set %I = $1 where %I = $2', child.schema_name, child.table_name, child.column_name, child.column_name)
      using auth_id, stale_id;
  end loop;

  -- These UUID arrays are identity-bearing fields without foreign keys.
  -- Replace the duplicate identity while retaining every other member.
  update public.families
  set member_ids = array_prepend(auth_id, array_remove(array_replace(member_ids, stale_id, auth_id), auth_id))
  where stale_id = any(member_ids);

  update public.expenses
  set split_with = array_prepend(auth_id, array_remove(array_replace(split_with, stale_id, auth_id), auth_id))
  where stale_id = any(split_with);

  -- The stale profile currently owns the unique email value. Clear it only
  -- after capturing the verified Auth email and immediately before assigning
  -- that value to the authoritative profile; the whole operation is atomic.
  update public.users
  set email = null
  where id = stale_id;

  -- Merge only missing profile fields. Auth email is authoritative; an active
  -- authoritative deletion state/plan/preferences are never downgraded.
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
      deleted_at = authoritative.deleted_at,
      updated_at = now()
  from public.users stale
  where authoritative.id = auth_id and stale.id = stale_id;

  -- Verify every direct FK and ownership array before removing the stale
  -- profile. Any failure aborts the complete transaction.
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
    if child_count > 0 then
      raise exception 'Auth profile reconciliation failed: stale ownership remains in %.%(%)', child.schema_name, child.table_name, child.column_name;
    end if;
  end loop;

  select exists(select 1 from public.families where stale_id = any(member_ids)),
         exists(select 1 from public.expenses where stale_id = any(split_with))
    into has_stale_array_value, stale_exists;
  if has_stale_array_value or stale_exists then
    raise exception 'Auth profile reconciliation failed: stale ownership remains in an identity array';
  end if;

  delete from public.users where id = stale_id;

  if exists(select 1 from public.users where id = stale_id)
     or not exists(select 1 from public.users where id = auth_id and email = auth_email) then
    raise exception 'Auth profile reconciliation failed its profile postcondition';
  end if;

  raise notice 'Auth profile reconciliation completed: ownership rows transferred without changing record identities.';
end;
$$;

revoke all on function public.reconcile_auth_profile(uuid, uuid) from public;

do $$
begin
  perform public.reconcile_auth_profile(
    'd1c42961-11b2-4cdf-a8c0-aa6f5fa65b58'::uuid,
    '3ce04d2c-648d-40fe-9206-f012ac56bc48'::uuid
  );
end;
$$;

-- The reviewed orphan is gone before the identity foreign key is validated.
-- If another orphan exists, fail closed and require a separate reviewed repair.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_id_auth_users_fkey'
      and not convalidated
  ) then
    alter table public.users validate constraint users_id_auth_users_fkey;
  end if;
end;
$$;

-- Future Auth inserts must use NEW.id and never merge by email.
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
