create table public.wallet_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  from_wallet_id uuid not null references public.wallets(id) on delete restrict,
  to_wallet_id uuid not null references public.wallets(id) on delete restrict,
  amount numeric not null check (amount > 0),
  note text,
  transferred_at date not null default current_date,
  idempotency_key text,
  created_at timestamptz not null default now(),
  constraint wallet_transfers_different_wallets check (from_wallet_id <> to_wallet_id)
);

create unique index wallet_transfers_idempotency_idx
  on public.wallet_transfers (user_id, idempotency_key)
  where idempotency_key is not null;
create index wallet_transfers_from_idx on public.wallet_transfers (from_wallet_id, transferred_at desc);
create index wallet_transfers_to_idx on public.wallet_transfers (to_wallet_id, transferred_at desc);

alter table public.wallet_transfers enable row level security;
create policy "wallet_transfers_select_own" on public.wallet_transfers for select using (auth.uid() = user_id);
create policy "wallet_transfers_insert_own" on public.wallet_transfers for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.wallets w where w.id = from_wallet_id and w.user_id = auth.uid())
  and exists (select 1 from public.wallets w where w.id = to_wallet_id and w.user_id = auth.uid())
);

create or replace function public.recompute_wallet_balance(target_wallet_id uuid)
returns void as $$
begin
  update public.wallets w
  set balance =
    coalesce((select sum(i.amount) from public.income i where i.wallet_id = target_wallet_id and i.deleted_at is null), 0)
    + coalesce((select sum(a.amount) from public.wallet_adjustments a where a.wallet_id = target_wallet_id), 0)
    - coalesce((select sum(e.amount) from public.expenses e where e.wallet_id = target_wallet_id and e.deleted_at is null), 0)
    - coalesce((select sum(b.amount) from public.bills b where b.wallet_id = target_wallet_id and b.status = 'paid' and b.deleted_at is null
      and not exists (select 1 from public.expenses e where e.source_bill_id = b.id and e.deleted_at is null)), 0)
    - coalesce((select sum(t.amount) from public.wallet_transfers t where t.from_wallet_id = target_wallet_id), 0)
    + coalesce((select sum(t.amount) from public.wallet_transfers t where t.to_wallet_id = target_wallet_id), 0)
  where w.id = target_wallet_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.create_wallet_transfer(
  source_wallet_id uuid,
  destination_wallet_id uuid,
  transfer_amount numeric,
  transfer_note text,
  transfer_date date,
  request_key text
)
returns public.wallet_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  source_wallet public.wallets;
  destination_wallet public.wallets;
  allocated_amount numeric;
  result_row public.wallet_transfers;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if transfer_amount <= 0 then raise exception 'Transfer amount must be greater than zero'; end if;
  if source_wallet_id = destination_wallet_id then raise exception 'Choose a different destination wallet'; end if;

  if request_key is not null then
    select * into result_row from public.wallet_transfers where user_id = owner_id and idempotency_key = request_key;
    if found then return result_row; end if;
  end if;

  select * into source_wallet from public.wallets where id = source_wallet_id and user_id = owner_id for update;
  if not found then raise exception 'One of these wallets is no longer available'; end if;
  select * into destination_wallet from public.wallets where id = destination_wallet_id and user_id = owner_id for update;
  if not found then raise exception 'One of these wallets is no longer available'; end if;

  select coalesce(sum(amount), 0) into allocated_amount
  from public.goal_contributions where wallet_id = source_wallet_id and user_id = owner_id;
  if transfer_amount > source_wallet.balance - allocated_amount then
    raise exception 'The source wallet does not have enough available funds';
  end if;

  insert into public.wallet_transfers (user_id, from_wallet_id, to_wallet_id, amount, note, transferred_at, idempotency_key)
  values (owner_id, source_wallet_id, destination_wallet_id, transfer_amount, nullif(trim(transfer_note), ''), coalesce(transfer_date, current_date), request_key)
  returning * into result_row;

  perform public.recompute_wallet_balance(source_wallet_id);
  perform public.recompute_wallet_balance(destination_wallet_id);
  return result_row;
exception when unique_violation then
  select * into result_row from public.wallet_transfers where user_id = owner_id and idempotency_key = request_key;
  if found then return result_row; end if;
  raise;
end;
$$;

revoke all on function public.create_wallet_transfer(uuid, uuid, numeric, text, date, text) from public;
grant execute on function public.create_wallet_transfer(uuid, uuid, numeric, text, date, text) to authenticated;
