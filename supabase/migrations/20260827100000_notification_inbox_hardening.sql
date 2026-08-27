-- Forward-only hardening for the existing public.notifications table.
-- The backend is the only writer; clients may only change read state.
alter table public.notifications
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists action jsonb,
  add column if not exists deduplication_key text;

-- Backfill legacy rows before enforcing idempotency for new scheduler events.
update public.notifications
set deduplication_key = concat('legacy:', id::text)
where deduplication_key is null;

drop index if exists public.notifications_event_unique;
create unique index if not exists notifications_user_deduplication_unique
  on public.notifications (user_id, deduplication_key)
  where deduplication_key is not null;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

drop policy if exists "notifications_crud_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications_update_read_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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
    or new.related_subscription_id is distinct from old.related_subscription_id
    or new.related_wallet_id is distinct from old.related_wallet_id
    or new.period_key is distinct from old.period_key
  then
    raise exception 'Only notification read state may be updated.';
  end if;
  new.read = (new.read_at is not null);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_notification_content on public.notifications;
create trigger protect_notification_content
before update on public.notifications
for each row execute function public.protect_notification_content();
