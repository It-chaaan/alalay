create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  related_bill_id uuid references public.bills(id) on delete set null,
  related_subscription_id uuid references public.subscriptions(id) on delete set null,
  related_wallet_id uuid references public.wallets(id) on delete set null,
  period_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id, read_at) where read_at is null;
create unique index notifications_event_unique on public.notifications (user_id, type, related_bill_id, related_subscription_id, related_wallet_id, period_key);
