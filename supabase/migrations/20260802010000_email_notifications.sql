create table public.notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  bill_reminders boolean not null default true,
  bill_reminder_days smallint not null default 3,
  subscription_reminders boolean not null default true,
  summaries boolean not null default false,
  overspending_alerts boolean not null default true,
  budget_thresholds boolean not null default true,
  savings_milestones boolean not null default true,
  login_alerts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_bill_days_check check (bill_reminder_days between 0 and 30)
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_crud_own"
  on public.notification_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  recipient_email text not null,
  related_bill_id uuid references public.bills(id) on delete set null,
  related_subscription_id uuid references public.subscriptions(id) on delete set null,
  period_key text,
  sent_on date not null default current_date,
  status text not null default 'sent',
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_log_type_check check (type in ('bill_due', 'subscription_renewal', 'monthly_summary')),
  constraint notifications_log_status_check check (status in ('sent', 'failed'))
);

alter table public.notifications_log enable row level security;

create index notifications_log_user_type_idx on public.notifications_log (user_id, type, sent_on);
create unique index notifications_log_bill_daily_unique
  on public.notifications_log (user_id, type, related_bill_id, sent_on)
  where related_bill_id is not null and status = 'sent';
create unique index notifications_log_subscription_daily_unique
  on public.notifications_log (user_id, type, related_subscription_id, sent_on)
  where related_subscription_id is not null and status = 'sent';
create unique index notifications_log_summary_period_unique
  on public.notifications_log (user_id, type, period_key)
  where type = 'monthly_summary' and status = 'sent';
