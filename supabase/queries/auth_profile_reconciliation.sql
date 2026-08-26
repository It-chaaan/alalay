-- READ-ONLY incident report. Run in Supabase SQL Editor with a role allowed
-- to inspect auth metadata. This intentionally reports counts and booleans,
-- never profile emails, balances, receipt content, or full records.

with incident(auth_id, stale_id) as (
  values (
    'd1c42961-11b2-4cdf-a8c0-aa6f5fa65b58'::uuid,
    '3ce04d2c-648d-40fe-9206-f012ac56bc48'::uuid
  )
)
select
  exists(select 1 from auth.users a, incident i where a.id = i.auth_id) as auth_identity_exists,
  exists(select 1 from auth.users a, incident i where a.id = i.stale_id) as stale_auth_identity_exists,
  exists(select 1 from public.users p, incident i where p.id = i.auth_id) as authoritative_profile_exists,
  exists(select 1 from public.users p, incident i where p.id = i.stale_id) as stale_profile_exists,
  (
    select lower(nullif(trim(a.email), '')) = lower(nullif(trim(p.email), ''))
    from auth.users a
    join public.users p on p.id = (select stale_id from incident)
    where a.id = (select auth_id from incident)
  ) as normalized_identity_matches,
  (
    select lower(nullif(trim(p.email), '')) is null
    from public.users p where p.id = (select auth_id from incident)
  ) as authoritative_profile_email_is_null;

do $$
declare
  auth_id constant uuid := 'd1c42961-11b2-4cdf-a8c0-aa6f5fa65b58';
  stale_id constant uuid := '3ce04d2c-648d-40fe-9206-f012ac56bc48';
  child record;
  row_count bigint;
begin
  raise notice 'Incident child-reference counts follow; no row contents are emitted.';
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
      into row_count using stale_id;
    raise notice '%.%(%): stale_count=%', child.schema_name, child.table_name, child.column_name, row_count;
  end loop;

  raise notice 'Ownership arrays: families.member_ids stale_count=%, expenses.split_with stale_count=%',
    (select count(*) from public.families where stale_id = any(member_ids)),
    (select count(*) from public.expenses where stale_id = any(split_with));
  raise notice 'Unique constraints involving direct ownership columns are listed below.';
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
      and exists (
        select 1 from pg_index i
        where i.indrelid = c.oid and i.indisunique and a.attnum = any(i.indkey)
      )
    order by n.nspname, c.relname, a.attname
  loop
    raise notice 'unique ownership key: %.%(%)', child.schema_name, child.table_name, child.column_name;
  end loop;
end;
$$;

-- Migration history must be checked separately with `supabase migration list`.
