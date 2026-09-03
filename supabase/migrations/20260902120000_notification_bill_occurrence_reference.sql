-- A Bill reminder concerns an immutable occurrence, while related_bill_id
-- remains the optional editable parent/template reference.
alter table public.notifications
  add column if not exists related_bill_occurrence_id uuid
  references public.bill_occurrences(id) on delete set null;

create index if not exists notifications_bill_occurrence_idx
  on public.notifications (related_bill_occurrence_id)
  where related_bill_occurrence_id is not null;

-- Keep the read-state-only trigger aligned with the new immutable relation.
create or replace function public.protect_notification_content()
returns trigger as $$
begin
  if new.user_id is distinct from old.user_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at
    or new.source_type is distinct from old.source_type
    or new.source_id is distinct from old.source_id
    or new.action is distinct from old.action
    or new.deduplication_key is distinct from old.deduplication_key
    or new.related_bill_id is distinct from old.related_bill_id
    or new.related_bill_occurrence_id is distinct from old.related_bill_occurrence_id
    or new.related_subscription_id is distinct from old.related_subscription_id
    or new.related_wallet_id is distinct from old.related_wallet_id
    or new.period_key is distinct from old.period_key
  then raise exception 'Only notification read state may be updated.';
  end if;
  new.read = (new.read_at is not null);
  return new;
end;
$$ language plpgsql security definer set search_path = public;
