-- Allow the trusted backend scheduler to process every due subscription while
-- preserving the authenticated self-service form of the RPC. The previous
-- implementation recognized service_role, then unconditionally rejected its
-- intentionally null target_user_id.
create or replace function public.process_subscription_billing_occurrences(
  target_user_id uuid default null,
  target_through date default null
) returns table(
  processed integer,
  occurrences_created integer,
  expenses_created integer,
  duplicates_skipped integer,
  failed integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_date date;
  v_occurrence_id uuid;
  v_expense_id uuid;
  v_new boolean;
begin
  if auth.role() = 'service_role' then
    -- A null target is reserved for the verified service-role request and
    -- deliberately means all users. A non-null target remains useful for
    -- trusted backend work scoped to one owner.
    null;
  elsif auth.uid() is null then
    raise exception 'authentication required';
  elsif target_user_id is null then
    target_user_id := auth.uid();
  elsif target_user_id <> auth.uid() then
    raise exception 'not authorized';
  end if;

  target_through := coalesce(target_through, timezone('Asia/Manila', now())::date);
  processed := 0;
  occurrences_created := 0;
  expenses_created := 0;
  duplicates_skipped := 0;
  failed := 0;

  for s in
    select subscription.*
    from public.subscriptions as subscription
    where (target_user_id is null or subscription.user_id = target_user_id)
      and subscription.auto_renew
      and subscription.deleted_at is null
      and subscription.renewal_date <= target_through
    order by subscription.id
    for update of subscription
  loop
    begin
      v_date := s.renewal_date;
      while v_date <= target_through loop
        v_occurrence_id := null;
        insert into public.subscription_occurrences (
          user_id,
          subscription_id,
          occurrence_date,
          amount,
          wallet_id,
          recurrence_key
        ) values (
          s.user_id,
          s.id,
          v_date,
          s.amount,
          s.wallet_id,
          s.id::text || ':' || v_date::text || ':' || s.billing_cycle
        )
        on conflict (subscription_id, occurrence_date) do nothing
        returning id into v_occurrence_id;

        if v_occurrence_id is null then
          select occurrence.id
          into v_occurrence_id
          from public.subscription_occurrences as occurrence
          where occurrence.subscription_id = s.id
            and occurrence.occurrence_date = v_date;
          duplicates_skipped := duplicates_skipped + 1;
        else
          occurrences_created := occurrences_created + 1;
        end if;

        insert into public.expenses (
          user_id,
          amount,
          category,
          merchant,
          date,
          payment_method,
          subscription_id,
          billing_cycle,
          occurrence_date,
          generated_by,
          recurrence_key,
          billing_status,
          generated_at,
          wallet_id,
          deleted_at
        ) values (
          s.user_id,
          s.amount,
          'Subscriptions',
          s.name || ' Subscription',
          v_date,
          'other',
          s.id,
          s.billing_cycle,
          v_date,
          'subscription',
          s.id::text || ':' || v_date::text || ':' || s.billing_cycle,
          'generated',
          now(),
          s.wallet_id,
          null
        )
        on conflict (user_id, subscription_id, occurrence_date, billing_cycle) do nothing
        returning id into v_expense_id;
        v_new := found;

        if not v_new then
          select expense.id
          into v_expense_id
          from public.expenses as expense
          where expense.user_id = s.user_id
            and expense.subscription_id = s.id
            and expense.occurrence_date = v_date
            and expense.billing_cycle = s.billing_cycle
            and expense.deleted_at is null
          limit 1;
          duplicates_skipped := duplicates_skipped + 1;
        else
          expenses_created := expenses_created + 1;
        end if;

        update public.subscription_occurrences
        set generated_expense_id = v_expense_id,
            status = 'processed'
        where id = v_occurrence_id;

        v_date := public.subscription_add_cycle(v_date, s.billing_cycle);
      end loop;

      update public.subscriptions
      set renewal_date = v_date
      where id = s.id
        and renewal_date = s.renewal_date;
      processed := processed + 1;
    exception when others then
      failed := failed + 1;
    end;
  end loop;

  return next;
end;
$$;

revoke all on function public.process_subscription_billing_occurrences(uuid, date)
  from public, anon;
grant execute on function public.process_subscription_billing_occurrences(uuid, date)
  to authenticated, service_role;

