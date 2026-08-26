-- Bill deletion is a soft delete. Verify owner isolation and the legacy
-- DELETE trigger path, including recurring bills.
begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  normal_bill uuid := gen_random_uuid();
  recurring_bill uuid := gen_random_uuid();
  rpc_bill uuid := gen_random_uuid();
  unauthorized boolean;
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (owner_id, 'authenticated', 'authenticated', owner_id || '@example.test', '{"provider":"email"}', '{}', now(), now()),
    (other_id, 'authenticated', 'authenticated', other_id || '@example.test', '{"provider":"email"}', '{}', now(), now());

  insert into public.bills (id, user_id, title, amount, category, due_date)
  values (normal_bill, owner_id, 'Delete normal bill', 10, 'Utilities', date '2026-08-20');
  insert into public.bills (id, user_id, title, amount, category, due_date, recurring, frequency)
  values (recurring_bill, owner_id, 'Delete recurring bill', 20, 'Utilities', date '2026-08-20', true, 'monthly');
  insert into public.bills (id, user_id, title, amount, category, due_date)
  values (rpc_bill, owner_id, 'Delete through RPC', 30, 'Utilities', date '2026-08-20');

  grant select, insert, update, delete on public.bills to authenticated;
  grant usage, select on all sequences in schema public to authenticated;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  if public.soft_delete_bill(rpc_bill) <> rpc_bill then
    raise exception 'Owner soft-delete RPC returned the wrong bill';
  end if;
  delete from public.bills where id = normal_bill;
  delete from public.bills where id = recurring_bill;

  perform set_config('request.jwt.claim.sub', other_id::text, true);
  delete from public.bills where id = normal_bill;
  begin
    perform public.soft_delete_bill(rpc_bill);
  exception when others then
    if sqlstate <> 'P0002' then raise; end if;
  end;

  perform set_config('role', 'anon', true);
  unauthorized := false;
  begin
    delete from public.bills where id = recurring_bill;
  exception when others then
    unauthorized := true;
  end;
  if not unauthorized then raise exception 'Anonymous bill deletion was accepted'; end if;

  perform set_config('role', 'postgres', true);
  if not exists (select 1 from public.bills where id = normal_bill and user_id = owner_id and deleted_at is not null)
    or not exists (select 1 from public.bills where id = recurring_bill and user_id = owner_id and deleted_at is not null)
    or not exists (select 1 from public.bills where id = rpc_bill and user_id = owner_id and deleted_at is not null) then
    raise exception 'Owner delete did not soft-delete all bill variants';
  end if;
end;
$$;

rollback;
