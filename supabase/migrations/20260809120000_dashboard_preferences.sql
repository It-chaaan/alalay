create table public.dashboard_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  overview_cards text[] not null default array['bills', 'spending', 'savings']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_preferences_cards_check check (
    cardinality(overview_cards) between 1 and 4
    and overview_cards <@ array['bills', 'spending', 'savings', 'budget']::text[]
  )
);

alter table public.dashboard_preferences enable row level security;

create policy "dashboard_preferences_crud_own"
  on public.dashboard_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger dashboard_preferences_updated_at
before update on public.dashboard_preferences
for each row execute function public.set_updated_at();

comment on table public.dashboard_preferences is 'Per-user mobile dashboard presentation preferences, including selected overview carousel cards.';
