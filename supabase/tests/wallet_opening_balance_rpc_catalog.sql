-- Run after all migrations. The old overloaded name must be gone and the
-- backend-facing v2 identity must resolve uniquely.
do $$
declare
  canonical_count integer;
  legacy_count integer;
begin
  select count(*) into canonical_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_wallet_with_opening_balance_v2';
  if canonical_count <> 1 then
    raise exception 'Expected one canonical wallet opening-balance RPC, found %', canonical_count;
  end if;

  select count(*) into legacy_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_wallet_with_opening_balance';
  if legacy_count <> 0 then
    raise exception 'Legacy overloaded wallet opening-balance RPCs remain: %', legacy_count;
  end if;
end;
$$;
