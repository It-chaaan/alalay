-- Resource deletion must use an owner-checked SECURITY DEFINER operation. The
-- legacy DELETE triggers were shared across resources and could reject a
-- legitimate owner update under RLS, producing an opaque API 500.
create or replace function public.soft_delete_owned_resource(
  target_resource_id uuid,
  target_resource text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  owner_id uuid := auth.uid();
  deleted_id uuid;
begin
  if owner_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if target_resource = 'expenses' then
    update public.expenses
    set deleted_at = clock_timestamp()
    where id = target_resource_id
      and user_id = owner_id
      and deleted_at is null
    returning id into deleted_id;
  elsif target_resource = 'subscriptions' then
    update public.subscriptions
    set deleted_at = clock_timestamp()
    where id = target_resource_id
      and user_id = owner_id
      and deleted_at is null
    returning id into deleted_id;

    -- A cancelled subscription must not leave an upcoming generated charge in
    -- the wallet or dashboard. Historical charges remain part of history.
    if deleted_id is not null then
      update public.expenses
      set deleted_at = clock_timestamp()
      where user_id = owner_id
        and subscription_id = deleted_id
        and date >= current_date
        and deleted_at is null;
    end if;
  else
    raise exception 'unsupported resource' using errcode = '22023';
  end if;

  if deleted_id is null then
    raise exception 'record not found' using errcode = 'P0002';
  end if;

  return deleted_id;
end;
$$;

revoke all on function public.soft_delete_owned_resource(uuid, text) from public;
grant execute on function public.soft_delete_owned_resource(uuid, text) to authenticated;

-- Supabase Storage rejects direct writes to storage.objects from this trigger.
-- Removing the trigger restores safe Auth hard deletion; avatar files are
-- private and user-ID scoped, and can be purged through the Storage API by an
-- administrative lifecycle job rather than a database trigger.
drop trigger if exists delete_profile_avatar_on_user_delete on public.users;
drop function if exists public.delete_profile_avatar_on_user_delete();

notify pgrst, 'reload schema';
