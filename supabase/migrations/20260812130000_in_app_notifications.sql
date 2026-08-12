-- Upgrade the original in-app notifications table. The initial schema already
-- created public.notifications with a boolean read flag, so do not recreate it.
alter table public.notifications
  add column if not exists read_at timestamptz,
  add column if not exists related_bill_id uuid references public.bills(id) on delete set null,
  add column if not exists related_subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists related_wallet_id uuid references public.wallets(id) on delete set null,
  add column if not exists period_key text;

update public.notifications
set read_at = created_at
where read = true and read_at is null;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (type in (
    'bill_due', 'bill_overdue', 'subscription_renewal',
    'subscription_funding_warning', 'monthly_summary',
    'savings_milestone', 'ai_insight'
  ));

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at)
  where read_at is null;
create unique index if not exists notifications_event_unique
  on public.notifications (user_id, type, related_bill_id, related_subscription_id, related_wallet_id, period_key);
