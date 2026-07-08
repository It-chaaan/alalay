create table public.budget_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  categories jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_plans_user_id_key unique (user_id)
);

alter table public.budget_plans enable row level security;

create policy "budget_plans_select_own"
  on public.budget_plans
  for select
  using (auth.uid() = user_id);

create policy "budget_plans_insert_own"
  on public.budget_plans
  for insert
  with check (auth.uid() = user_id);

create policy "budget_plans_update_own"
  on public.budget_plans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger budget_plans_updated_at
before update on public.budget_plans
for each row execute function public.set_updated_at();
