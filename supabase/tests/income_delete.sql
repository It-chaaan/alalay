-- Structural regression checks for the atomic income cancellation RPC.
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_income'
      and pg_get_function_identity_arguments(p.oid) = 'target_income_id uuid'
  ) then
    raise exception 'delete_income(uuid) RPC is missing';
  end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.income'::regclass
      and c.conname = 'income_schedule_id_fkey'
      and c.confdeltype = 'r'
  ) then
    raise exception 'income schedule history FK must remain restrictive';
  end if;
end;
$$;
