create table public.savings_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  remaining_savings_behavior text not null default 'auto_general',
  general_savings_label text not null default 'General Savings',
  emergency_fund_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_preferences_user_id_key unique (user_id),
  constraint savings_preferences_behavior_check check (remaining_savings_behavior in ('auto_general', 'leave_unallocated', 'ask_monthly'))
);

alter table public.savings_preferences enable row level security;

create policy "savings_preferences_select_own"
  on public.savings_preferences
  for select
  using (auth.uid() = user_id);

create policy "savings_preferences_insert_own"
  on public.savings_preferences
  for insert
  with check (auth.uid() = user_id);

create policy "savings_preferences_update_own"
  on public.savings_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger savings_preferences_updated_at
before update on public.savings_preferences
for each row execute function public.set_updated_at();

comment on table public.savings_preferences is 'User-level savings allocation preferences for monthly savings budget, general savings behavior, and future emergency-fund routing.';
