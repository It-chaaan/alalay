create table public.wallet_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  wallet_id uuid references public.wallets(id) on delete set null,
  amount numeric not null check (amount > 0),
  date date not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.wallet_adjustments enable row level security;
create policy "wallet_adjustments_select_own" on public.wallet_adjustments for select using (auth.uid() = user_id);
create policy "wallet_adjustments_insert_own" on public.wallet_adjustments for insert with check (auth.uid() = user_id);
create policy "wallet_adjustments_update_own" on public.wallet_adjustments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wallet_adjustments_delete_own" on public.wallet_adjustments for delete using (auth.uid() = user_id);

create trigger wallet_adjustments_owner_check before insert or update on public.wallet_adjustments
for each row execute function public.validate_wallet_owner();

create or replace function public.recompute_wallet_balance(target_wallet_id uuid)
returns void as $$
begin
  update public.wallets w
  set balance =
    coalesce((select sum(i.amount) from public.income i where i.wallet_id = target_wallet_id and i.deleted_at is null), 0)
    + coalesce((select sum(a.amount) from public.wallet_adjustments a where a.wallet_id = target_wallet_id), 0)
    - coalesce((select sum(e.amount) from public.expenses e where e.wallet_id = target_wallet_id and e.deleted_at is null), 0)
    - coalesce((select sum(b.amount) from public.bills b where b.wallet_id = target_wallet_id and b.status = 'paid' and b.deleted_at is null), 0)
  where w.id = target_wallet_id;
end;
$$ language plpgsql security definer set search_path = public;

create trigger wallet_adjustments_balance_update after insert or update or delete on public.wallet_adjustments
for each row execute function public.recompute_wallet_balances();
