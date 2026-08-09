create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  institution_type text not null default 'cash',
  institution_key text not null default 'cash',
  balance numeric not null default 0,
  icon text,
  color text not null default '#0F8A6B',
  is_default_cash boolean not null default false,
  created_at timestamptz not null default now(),
  constraint wallets_institution_type_check check (institution_type in ('e_wallet', 'digital_bank', 'bank', 'cash', 'other'))
);

alter table public.wallets enable row level security;
create policy "wallets_select_own" on public.wallets for select using (auth.uid() = user_id);
create policy "wallets_insert_own" on public.wallets for insert with check (auth.uid() = user_id);
create policy "wallets_update_own" on public.wallets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wallets_delete_own" on public.wallets for delete using (auth.uid() = user_id and is_default_cash = false);
create unique index wallets_one_default_cash_per_user on public.wallets (user_id) where is_default_cash;
create index wallets_user_id_idx on public.wallets (user_id, created_at);

alter table public.income add column if not exists wallet_id uuid references public.wallets(id) on delete restrict;
alter table public.expenses add column if not exists wallet_id uuid references public.wallets(id) on delete set null;
alter table public.bills add column if not exists wallet_id uuid references public.wallets(id) on delete set null;
alter table public.subscriptions add column if not exists wallet_id uuid references public.wallets(id) on delete set null;
create index income_wallet_id_idx on public.income (wallet_id) where wallet_id is not null;
create index expenses_wallet_id_idx on public.expenses (wallet_id) where wallet_id is not null;
create index bills_wallet_id_idx on public.bills (wallet_id) where wallet_id is not null;
create index subscriptions_wallet_id_idx on public.subscriptions (wallet_id) where wallet_id is not null;

create or replace function public.validate_wallet_owner()
returns trigger as $$
begin
  if new.wallet_id is not null and not exists (
    select 1 from public.wallets w where w.id = new.wallet_id and w.user_id = new.user_id
  ) then
    raise exception 'wallet does not belong to transaction owner';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger income_wallet_owner_check before insert or update on public.income
for each row execute function public.validate_wallet_owner();
create trigger expenses_wallet_owner_check before insert or update on public.expenses
for each row execute function public.validate_wallet_owner();
create trigger bills_wallet_owner_check before insert or update on public.bills
for each row execute function public.validate_wallet_owner();
create trigger subscriptions_wallet_owner_check before insert or update on public.subscriptions
for each row execute function public.validate_wallet_owner();

create or replace function public.ensure_default_cash_wallet(target_user_id uuid)
returns void as $$
begin
  insert into public.wallets (user_id, name, institution_type, institution_key, color, is_default_cash)
  values (target_user_id, 'Cash', 'cash', 'cash', '#0F8A6B', true)
  on conflict (user_id) where is_default_cash do nothing;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.email
  );
  perform public.ensure_default_cash_wallet(new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.recompute_wallet_balance(target_wallet_id uuid)
returns void as $$
begin
  update public.wallets w
  set balance =
    coalesce((select sum(i.amount) from public.income i where i.wallet_id = target_wallet_id and i.deleted_at is null), 0)
    - coalesce((select sum(e.amount) from public.expenses e where e.wallet_id = target_wallet_id and e.deleted_at is null), 0)
    - coalesce((select sum(b.amount) from public.bills b where b.wallet_id = target_wallet_id and b.status = 'paid' and b.deleted_at is null), 0)
  where w.id = target_wallet_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.recompute_wallet_balances()
returns trigger as $$
begin
  if tg_op <> 'INSERT' and old.wallet_id is not null then perform public.recompute_wallet_balance(old.wallet_id); end if;
  if tg_op <> 'DELETE' and new.wallet_id is not null then perform public.recompute_wallet_balance(new.wallet_id); end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

create trigger income_wallet_balance_update after insert or update or delete on public.income
for each row execute function public.recompute_wallet_balances();
create trigger expenses_wallet_balance_update after insert or update or delete on public.expenses
for each row execute function public.recompute_wallet_balances();
create trigger bills_wallet_balance_update after insert or update or delete on public.bills
for each row execute function public.recompute_wallet_balances();

-- Backfill legacy users without changing any existing transaction balances.
do $$
declare user_row record;
begin
  for user_row in select id from public.users loop perform public.ensure_default_cash_wallet(user_row.id); end loop;
end;
$$;

update public.income i
set wallet_id = w.id
from public.wallets w
where w.user_id = i.user_id and w.is_default_cash and i.wallet_id is null;
alter table public.income alter column wallet_id set not null;
