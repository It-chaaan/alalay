-- Bills use soft-delete semantics: a DELETE is converted to an UPDATE that
-- stamps deleted_at. The original trigger performed that UPDATE as the
-- invoking role, which could fail RLS with 42501 for legacy/direct DELETE
-- callers even when the DELETE itself was owner-authorized.

drop policy if exists "bills_delete_own_soft" on public.bills;
create policy "bills_delete_own_soft"
  on public.bills
  for delete
  using (auth.uid() = user_id);

drop policy if exists "bills_update_own" on public.bills;
create policy "bills_update_own"
  on public.bills
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.soft_delete_bills()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  authenticated_user_id uuid := auth.uid();
begin
  -- The table DELETE policy already restricts the outer operation. Keep the
  -- owner check here as defense in depth because this function bypasses RLS.
  if authenticated_user_id is null or old.user_id <> authenticated_user_id then
    raise exception 'bill deletion authorization required'
      using errcode = '42501';
  end if;

  execute format(
    'update public.%I set deleted_at = clock_timestamp() where id = $1 and user_id = $2 and deleted_at is null',
    tg_table_name
  ) using old.id, old.user_id;

  return null;
end;
$$;

revoke all on function public.soft_delete_bills() from public;
