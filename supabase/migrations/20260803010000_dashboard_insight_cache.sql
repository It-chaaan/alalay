create table public.dashboard_insights (
  user_id uuid primary key references public.users(id) on delete cascade,
  message text not null,
  generated_at timestamptz not null default now()
);

alter table public.dashboard_insights enable row level security;

create policy "dashboard_insights_crud_own"
  on public.dashboard_insights
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.dashboard_insights is 'Cached personalized Dashboard AI insight, regenerated at most once per day.';
