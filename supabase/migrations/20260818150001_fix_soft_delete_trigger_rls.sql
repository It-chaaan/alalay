-- The original soft_delete_bills trigger function always updated public.bills
-- as the invoking user. A direct DELETE therefore ran a second UPDATE that
-- could be rejected by bills RLS (42501: new row violates row-level policy).
-- Keep soft-delete semantics, but make the trigger generic for the legacy
-- triggers on bills/expenses/income/subscriptions and validate ownership
-- explicitly inside a narrowly-scoped SECURITY DEFINER function.
create or replace function public.soft_delete_bills()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  execute format('update public.%I set deleted_at = now() where id = $1 and user_id = $2', tg_table_name)
    using old.id, auth.uid();
  return null;
end;
$$;

revoke all on function public.soft_delete_bills() from public;
