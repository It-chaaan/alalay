-- Delete bills through an explicit owner-scoped soft-delete RPC. This avoids
-- the legacy table DELETE trigger path for bills that have linked payment
-- expenses while preserving the bill and its financial history.
create or replace function public.soft_delete_bill(target_bill_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  authenticated_user_id uuid := auth.uid();
  deleted_bill_id uuid;
begin
  if authenticated_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.bills
  set deleted_at = clock_timestamp()
  where id = target_bill_id
    and user_id = authenticated_user_id
    and deleted_at is null
  returning id into deleted_bill_id;

  if deleted_bill_id is null then
    raise exception 'bill not found' using errcode = 'P0002';
  end if;

  return deleted_bill_id;
end;
$$;

revoke all on function public.soft_delete_bill(uuid) from public;
grant execute on function public.soft_delete_bill(uuid) to authenticated;
