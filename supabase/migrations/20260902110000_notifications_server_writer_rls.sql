-- Notifications are written only by trusted backend code using the Supabase
-- service role. RLS remains enabled for normal authenticated mobile reads and
-- read-state updates; there is deliberately no client INSERT policy.
alter table public.notifications enable row level security;

drop policy if exists "notifications_crud_own" on public.notifications;
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_read_own" on public.notifications;

create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications_update_read_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
