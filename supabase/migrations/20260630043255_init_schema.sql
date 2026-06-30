create extension if not exists "pgcrypto";

create table public.users (
  id uuid primary key,
  name text,
  email text unique,
  avatar_url text,
  currency text not null default 'PHP',
  language text not null default 'en',
  plan text not null default 'free',
  income numeric not null default 0,
  pay_schedule text not null default 'monthly',
  health_score smallint not null default 0,
  onboarding_done boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_language_check check (language in ('en', 'fil')),
  constraint users_plan_check check (plan in ('free', 'plus', 'family')),
  constraint users_pay_schedule_check check (pay_schedule in ('monthly', 'semi-monthly', 'weekly'))
);

alter table public.users enable row level security;

create policy "users_select_own"
  on public.users
  for select
  using (auth.uid() = id);

create policy "users_update_own"
  on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

comment on table public.users is 'User profiles and account preferences.';

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references public.users(id),
  member_ids uuid[] not null default '{}',
  plan text not null default 'family',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint families_plan_check check (plan = 'family')
);

alter table public.families enable row level security;

create policy "families_select_owner_or_member"
  on public.families
  for select
  using (auth.uid() = owner_id or auth.uid() = any(member_ids));

create policy "families_insert_owner"
  on public.families
  for insert
  with check (auth.uid() = owner_id);

create policy "families_update_owner"
  on public.families
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "families_delete_owner"
  on public.families
  for delete
  using (auth.uid() = owner_id);

comment on table public.families is 'Family groups for shared budgeting and bill tracking.';

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  family_id uuid references public.families(id),
  title text not null,
  amount numeric not null,
  category text not null,
  due_date date not null,
  recurring boolean not null default false,
  frequency text,
  status text not null default 'unpaid',
  paid_at timestamptz,
  notes text,
  attachment_url text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bills_frequency_check check (frequency in ('monthly', 'weekly', 'yearly', 'quarterly') or frequency is null),
  constraint bills_status_check check (status in ('unpaid', 'paid', 'overdue'))
);

alter table public.bills enable row level security;

create policy "bills_select_own"
  on public.bills
  for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "bills_insert_own"
  on public.bills
  for insert
  with check (auth.uid() = user_id);

create policy "bills_update_own"
  on public.bills
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "bills_delete_own_soft"
  on public.bills
  for delete
  using (auth.uid() = user_id);

create or replace function public.soft_delete_bills()
returns trigger as $$
begin
  update public.bills
  set deleted_at = now()
  where id = old.id;
  return null;
end;
$$ language plpgsql;

create trigger bills_soft_delete
before delete on public.bills
for each row execute function public.soft_delete_bills();

create index bills_user_id_due_date_idx on public.bills (user_id, due_date);
create index bills_status_idx on public.bills (status);

comment on table public.bills is 'Recurring and one-time bills with due dates and payment status.';

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  amount numeric not null,
  category text not null,
  merchant text not null,
  date date not null,
  payment_method text not null default 'cash',
  receipt_url text,
  ocr_raw jsonb,
  is_split boolean not null default false,
  split_with uuid[] not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_payment_method_check check (payment_method in ('cash', 'card', 'gcash', 'maya', 'bank_transfer', 'other'))
);

alter table public.expenses enable row level security;

create policy "expenses_select_own"
  on public.expenses
  for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "expenses_insert_own"
  on public.expenses
  for insert
  with check (auth.uid() = user_id);

create policy "expenses_update_own"
  on public.expenses
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "expenses_delete_own_soft"
  on public.expenses
  for delete
  using (auth.uid() = user_id);

create trigger expenses_soft_delete
before delete on public.expenses
for each row execute function public.soft_delete_bills();

create index expenses_user_id_date_idx on public.expenses (user_id, date);

comment on table public.expenses is 'Expense entries with merchant, category, and receipt metadata.';

create table public.income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  source text not null,
  type text not null default 'salary',
  amount numeric not null,
  date date not null,
  is_recurring boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint income_type_check check (type in ('salary', 'freelance', 'business', 'remittance', 'other'))
);

alter table public.income enable row level security;

create policy "income_select_own"
  on public.income
  for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "income_insert_own"
  on public.income
  for insert
  with check (auth.uid() = user_id);

create policy "income_update_own"
  on public.income
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "income_delete_own_soft"
  on public.income
  for delete
  using (auth.uid() = user_id);

create trigger income_soft_delete
before delete on public.income
for each row execute function public.soft_delete_bills();

comment on table public.income is 'Income sources and recurring earnings.';

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  name text not null,
  logo_url text,
  amount numeric not null,
  renewal_date date not null,
  billing_cycle text not null default 'monthly',
  auto_renew boolean not null default true,
  last_used_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_billing_cycle_check check (billing_cycle in ('monthly', 'yearly'))
);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "subscriptions_insert_own"
  on public.subscriptions
  for insert
  with check (auth.uid() = user_id);

create policy "subscriptions_update_own"
  on public.subscriptions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "subscriptions_delete_own_soft"
  on public.subscriptions
  for delete
  using (auth.uid() = user_id);

create trigger subscriptions_soft_delete
before delete on public.subscriptions
for each row execute function public.soft_delete_bills();

create index subscriptions_renewal_date_idx on public.subscriptions (renewal_date);

comment on table public.subscriptions is 'Subscription accounts, renewal dates, and auto-renew settings.';

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  family_id uuid references public.families(id),
  title text not null,
  emoji text not null default '💰',
  target_amount numeric not null,
  current_amount numeric not null default 0,
  deadline date not null,
  monthly_target numeric not null default 0,
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.savings_goals enable row level security;

create policy "savings_goals_select_own"
  on public.savings_goals
  for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "savings_goals_insert_own"
  on public.savings_goals
  for insert
  with check (auth.uid() = user_id);

create policy "savings_goals_update_own"
  on public.savings_goals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "savings_goals_delete_own_soft"
  on public.savings_goals
  for delete
  using (auth.uid() = user_id);

create trigger savings_goals_soft_delete
before delete on public.savings_goals
for each row execute function public.soft_delete_bills();

create index savings_goals_user_id_idx on public.savings_goals (user_id);

comment on table public.savings_goals is 'Savings targets and progress tracking.';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  title text not null,
  body text not null,
  type text not null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (type in ('bill_due', 'bill_overdue', 'subscription_renewal', 'savings_milestone', 'ai_insight'))
);

alter table public.notifications enable row level security;

create policy "notifications_crud_own"
  on public.notifications
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.notifications is 'User notifications for bill, subscription, savings, and AI events.';

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  type text not null,
  message text not null,
  action_label text,
  action_route text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ai_insights_type_check check (type in ('spending_anomaly', 'upcoming_bills', 'overdue', 'subscription_audit', 'savings_nudge', 'budget_warning'))
);

alter table public.ai_insights enable row level security;

create policy "ai_insights_crud_own"
  on public.ai_insights
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.ai_insights is 'Generated financial insights and suggested actions.';

create table public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  email text not null,
  access_token text not null,
  refresh_token text not null,
  last_synced_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.gmail_connections enable row level security;

create policy "gmail_connections_crud_own"
  on public.gmail_connections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.gmail_connections is 'Gmail connection credentials for inbox-based bill detection. access_token and refresh_token must only ever be written/read from Edge Functions using the service role key, never from the client; this is a defense-in-depth note and not a substitute for keeping the anon key from fetching these columns in practice.';

create table public.bill_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  source text not null,
  biller_name text not null,
  amount numeric,
  due_date date,
  raw_data jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint bill_suggestions_source_check check (source in ('gmail', 'ocr')),
  constraint bill_suggestions_status_check check (status in ('pending', 'confirmed', 'ignored'))
);

alter table public.bill_suggestions enable row level security;

create policy "bill_suggestions_crud_own"
  on public.bill_suggestions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.bill_suggestions is 'Potential bills extracted from Gmail or OCR before confirmation.';

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger set_families_updated_at
before update on public.families
for each row execute function public.set_updated_at();

create trigger set_bills_updated_at
before update on public.bills
for each row execute function public.set_updated_at();

create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create trigger set_income_updated_at
before update on public.income
for each row execute function public.set_updated_at();

create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create trigger set_savings_goals_updated_at
before update on public.savings_goals
for each row execute function public.set_updated_at();

create or replace function public.set_savings_goal_monthly_target()
returns trigger as $$
begin
  if new.deadline > current_date then
    new.monthly_target := (new.target_amount - new.current_amount) / greatest(1, (new.deadline - current_date) / 30);
  else
    new.monthly_target := 0;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger set_savings_goals_monthly_target
before insert or update on public.savings_goals
for each row execute function public.set_savings_goal_monthly_target();
