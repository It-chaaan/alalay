create table if not exists public.ai_action_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  request_id uuid not null,
  action text not null,
  status text not null check (status in ('processing', 'succeeded')),
  result jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);

alter table public.ai_action_requests enable row level security;
create policy "ai_action_requests_select_own" on public.ai_action_requests for select using (auth.uid() = user_id);
create policy "ai_action_requests_insert_own" on public.ai_action_requests for insert with check (auth.uid() = user_id);
create policy "ai_action_requests_update_own" on public.ai_action_requests for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists ai_action_requests_created_idx on public.ai_action_requests (created_at);
