-- Transfer principal remains an internal movement. Fees and actual interest
-- are recorded through the existing expense/income ledgers for reporting.
alter table public.wallets
  add column if not exists default_outgoing_transfer_fee numeric,
  add column if not exists interest_rate numeric,
  add column if not exists interest_crediting_frequency text;

alter table public.wallets
  drop constraint if exists wallets_default_outgoing_transfer_fee_check,
  add constraint wallets_default_outgoing_transfer_fee_check check (default_outgoing_transfer_fee is null or default_outgoing_transfer_fee >= 0),
  drop constraint if exists wallets_interest_rate_check,
  add constraint wallets_interest_rate_check check (interest_rate is null or interest_rate >= 0),
  drop constraint if exists wallets_interest_crediting_frequency_check,
  add constraint wallets_interest_crediting_frequency_check check (interest_crediting_frequency is null or interest_crediting_frequency in ('monthly', 'quarterly', 'yearly', 'other'));

alter table public.income drop constraint if exists income_type_check;
alter table public.income add constraint income_type_check check (type in ('salary', 'freelance', 'business', 'remittance', 'interest', 'other'));

alter table public.wallet_transfers
  add column if not exists fee numeric not null default 0 check (fee >= 0),
  add column if not exists transfer_method text,
  add column if not exists fee_expense_id uuid references public.expenses(id) on delete restrict;

alter table public.wallet_transfers
  drop constraint if exists wallet_transfers_transfer_method_check,
  add constraint wallet_transfers_transfer_method_check check (transfer_method is null or transfer_method in ('instapay', 'pesonet', 'internal', 'other'));

create unique index if not exists wallet_transfers_fee_expense_idx on public.wallet_transfers (fee_expense_id) where fee_expense_id is not null;

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

drop function if exists public.create_wallet_transfer(uuid, uuid, numeric, text, date, text);
create function public.create_wallet_transfer(
  source_wallet_id uuid,
  destination_wallet_id uuid,
  transfer_amount numeric,
  transfer_fee numeric,
  transfer_method_value text,
  transfer_note text,
  transfer_date date,
  request_key text
)
returns public.wallet_transfers
language plpgsql security definer set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  source_wallet public.wallets;
  destination_wallet public.wallets;
  allocated_amount numeric;
  result_row public.wallet_transfers;
  fee_expense public.expenses;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if transfer_amount <= 0 then raise exception 'Transfer amount must be greater than zero'; end if;
  if transfer_fee < 0 then raise exception 'Transfer fee cannot be negative'; end if;
  if source_wallet_id = destination_wallet_id then raise exception 'Choose a different destination wallet'; end if;

  if request_key is not null then
    select * into result_row from public.wallet_transfers where user_id = owner_id and idempotency_key = request_key;
    if found then return result_row; end if;
  end if;

  select * into source_wallet from public.wallets where id = source_wallet_id and user_id = owner_id for update;
  if not found then raise exception 'One of these wallets is no longer available'; end if;
  select * into destination_wallet from public.wallets where id = destination_wallet_id and user_id = owner_id for update;
  if not found then raise exception 'One of these wallets is no longer available'; end if;

  select coalesce(sum(amount), 0) into allocated_amount from public.goal_contributions where wallet_id = source_wallet_id and user_id = owner_id;
  if transfer_amount + transfer_fee > source_wallet.balance - allocated_amount then
    raise exception 'The source wallet does not have enough available funds to cover the transfer and fee';
  end if;

  insert into public.wallet_transfers (user_id, from_wallet_id, to_wallet_id, amount, fee, transfer_method, note, transferred_at, idempotency_key)
  values (owner_id, source_wallet_id, destination_wallet_id, transfer_amount, transfer_fee, transfer_method_value, nullif(trim(transfer_note), ''), coalesce(transfer_date, current_date), request_key)
  returning * into result_row;

  if transfer_fee > 0 then
    insert into public.expenses (user_id, wallet_id, amount, category, merchant, date, payment_method)
    values (owner_id, source_wallet_id, transfer_fee, 'Bank Fees', 'Transfer fee', coalesce(transfer_date, current_date), 'bank_transfer')
    returning * into fee_expense;
    update public.wallet_transfers set fee_expense_id = fee_expense.id where id = result_row.id returning * into result_row;
  end if;

  perform public.recompute_wallet_balance(source_wallet_id);
  perform public.recompute_wallet_balance(destination_wallet_id);
  return result_row;
exception when unique_violation then
  select * into result_row from public.wallet_transfers where user_id = owner_id and idempotency_key = request_key;
  if found then return result_row; end if;
  raise;
end;
$$;

revoke all on function public.create_wallet_transfer(uuid, uuid, numeric, numeric, text, text, date, text) from public;
grant execute on function public.create_wallet_transfer(uuid, uuid, numeric, numeric, text, text, date, text) to authenticated;
