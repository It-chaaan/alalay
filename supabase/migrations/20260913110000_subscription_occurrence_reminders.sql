-- Subscription reminders are occurrence based. Existing generated expenses
-- are the immutable occurrence ledger; notifications reference their stable
-- subscription/date/cycle key through source_id and deduplication_key.
alter table public.notification_preferences
  add column if not exists subscription_reminder_three_days boolean not null default true,
  add column if not exists subscription_reminder_one_day boolean not null default true,
  add column if not exists subscription_reminder_due_day boolean not null default true,
  add column if not exists subscription_overdue_reminders boolean not null default true;

create index if not exists notifications_subscription_occurrence_idx
  on public.notifications (user_id, related_subscription_id, source_id)
  where related_subscription_id is not null and source_type = 'subscription_occurrence';

comment on index public.notifications_subscription_occurrence_idx is
  'Occurrence-level subscription reminder lookup; source_id is subscription_id:occurrence_date:billing_cycle.';
