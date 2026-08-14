alter table public.notification_preferences
  add column if not exists bill_reminder_three_days boolean not null default true,
  add column if not exists bill_reminder_one_day boolean not null default true,
  add column if not exists bill_reminder_due_day boolean not null default true,
  add column if not exists bill_overdue_reminders boolean not null default true,
  add column if not exists bill_reminder_hour smallint not null default 9,
  add column if not exists bill_reminder_minute smallint not null default 0;

alter table public.notification_preferences
  drop constraint if exists notification_preferences_bill_reminder_hour_check;
alter table public.notification_preferences
  add constraint notification_preferences_bill_reminder_hour_check check (bill_reminder_hour between 0 and 23);
alter table public.notification_preferences
  drop constraint if exists notification_preferences_bill_reminder_minute_check;
alter table public.notification_preferences
  add constraint notification_preferences_bill_reminder_minute_check check (bill_reminder_minute between 0 and 59);

alter table public.notifications_log
  drop constraint if exists notifications_log_type_check;
alter table public.notifications_log
  add constraint notifications_log_type_check check (type in ('bill_due', 'bill_overdue', 'subscription_renewal', 'subscription_funding_warning', 'monthly_summary'));
