-- Loans are balance-sheet positions. Principal never enters income or expenses;
-- only paid/received interest uses those reporting ledgers.
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  direction text not null check (direction in ('lent', 'borrowed')),
  counterparty text not null check (char_length(trim(counterparty)) between 1 and 120),
  original_principal numeric not null check (original_principal > 0),
  outstanding_principal numeric not null check (outstanding_principal >= 0),
  interest_type text not null default 'none' check (interest_type in ('none', 'fixed', 'simple')),
  interest_rate numeric check (interest_rate is null or interest_rate >= 0),
  fixed_interest_amount numeric check (fixed_interest_amount is null or fixed_interest_amount >= 0),
  start_date date not null default current_date,
  due_date date,
  status text not null default 'active' check (status in ('active', 'paid', 'written_off')),
  notes text,
  idempotency_key text,
  writeoff_expense_id uuid references public.expenses(id) on delete restrict,
  written_off_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or due_date >= start_date),
  check ((interest_type = 'none' and interest_rate is null and fixed_interest_amount is null)
    or (interest_type = 'fixed' and fixed_interest_amount is not null and interest_rate is null)
    or (interest_type = 'simple' and interest_rate is not null and fixed_interest_amount is null))
);

create unique index if not exists loans_user_idempotency_idx on public.loans(user_id, idempotency_key) where idempotency_key is not null;
create index if not exists loans_user_status_idx on public.loans(user_id, status, due_date);

create table if not exists public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete restrict,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  principal_amount numeric not null default 0 check (principal_amount >= 0),
  interest_amount numeric not null default 0 check (interest_amount >= 0),
  paid_on date not null default current_date,
  note text,
  interest_income_id uuid references public.income(id) on delete restrict,
  interest_expense_id uuid references public.expenses(id) on delete restrict,
  idempotency_key text,
  created_at timestamptz not null default now(),
  check (principal_amount + interest_amount > 0)
);

create unique index if not exists loan_payments_user_idempotency_idx on public.loan_payments(user_id, idempotency_key) where idempotency_key is not null;
create index if not exists loan_payments_loan_idx on public.loan_payments(loan_id, paid_on desc);

alter table public.loans enable row level security;
alter table public.loan_payments enable row level security;
drop policy if exists "Users manage own loans" on public.loans;
create policy "Users manage own loans" on public.loans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own loan payments" on public.loan_payments;
create policy "Users manage own loan payments" on public.loan_payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.recompute_wallet_balance(target_wallet_id uuid)
returns void as $$
begin
  update public.wallets w set balance =
    coalesce((select sum(i.amount) from public.income i where i.wallet_id = target_wallet_id and i.deleted_at is null), 0)
    + coalesce((select sum(a.amount) from public.wallet_adjustments a where a.wallet_id = target_wallet_id), 0)
    - coalesce((select sum(e.amount) from public.expenses e where e.wallet_id = target_wallet_id and e.deleted_at is null), 0)
    - coalesce((select sum(b.amount) from public.bills b where b.wallet_id = target_wallet_id and b.status = 'paid' and b.deleted_at is null and not exists (select 1 from public.expenses e where e.source_bill_id = b.id and e.deleted_at is null)), 0)
    - coalesce((select sum(t.amount) from public.wallet_transfers t where t.from_wallet_id = target_wallet_id), 0)
    + coalesce((select sum(t.amount) from public.wallet_transfers t where t.to_wallet_id = target_wallet_id), 0)
    - coalesce((select sum(l.original_principal) from public.loans l where l.wallet_id = target_wallet_id and l.direction = 'lent'), 0)
    + coalesce((select sum(l.original_principal) from public.loans l where l.wallet_id = target_wallet_id and l.direction = 'borrowed'), 0)
    + coalesce((select sum(p.principal_amount) from public.loan_payments p join public.loans l on l.id = p.loan_id where p.wallet_id = target_wallet_id and l.direction = 'lent'), 0)
    - coalesce((select sum(p.principal_amount) from public.loan_payments p join public.loans l on l.id = p.loan_id where p.wallet_id = target_wallet_id and l.direction = 'borrowed'), 0)
  where w.id = target_wallet_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.create_loan(wallet_id_value uuid, loan_direction text, counterparty_value text, principal_value numeric, interest_type_value text, interest_rate_value numeric, fixed_interest_value numeric, start_date_value date, due_date_value date, notes_value text, request_key text)
returns public.loans language plpgsql security definer set search_path = public as $$
declare owner_id uuid := auth.uid(); target_wallet public.wallets; result public.loans; allocated numeric;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if principal_value <= 0 then raise exception 'Principal must be greater than zero'; end if;
  if loan_direction not in ('lent','borrowed') then raise exception 'Invalid loan direction'; end if;
  if request_key is not null then select * into result from public.loans where user_id=owner_id and idempotency_key=request_key; if found then return result; end if; end if;
  select * into target_wallet from public.wallets where id=wallet_id_value and user_id=owner_id for update;
  if not found then raise exception 'Wallet is no longer available'; end if;
  if loan_direction='lent' then
    select coalesce(sum(amount),0) into allocated from public.goal_contributions where wallet_id=wallet_id_value and user_id=owner_id;
    if principal_value > target_wallet.balance - allocated then raise exception 'The wallet does not have enough available funds to lend this amount'; end if;
  end if;
  insert into public.loans(user_id,wallet_id,direction,counterparty,original_principal,outstanding_principal,interest_type,interest_rate,fixed_interest_amount,start_date,due_date,notes,idempotency_key)
  values(owner_id,wallet_id_value,loan_direction,trim(counterparty_value),principal_value,principal_value,interest_type_value,interest_rate_value,fixed_interest_value,coalesce(start_date_value,current_date),due_date_value,nullif(trim(notes_value),''),request_key) returning * into result;
  perform public.recompute_wallet_balance(wallet_id_value); return result;
exception when unique_violation then select * into result from public.loans where user_id=owner_id and idempotency_key=request_key; return result;
end; $$;

create or replace function public.record_loan_payment(loan_id_value uuid, wallet_id_value uuid, principal_value numeric, interest_value numeric, paid_on_value date, note_value text, request_key text)
returns public.loan_payments language plpgsql security definer set search_path = public as $$
declare owner_id uuid := auth.uid(); loan_row public.loans; wallet_row public.wallets; result public.loan_payments; allocated numeric; interest_income public.income; interest_expense public.expenses;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if principal_value < 0 or interest_value < 0 or principal_value + interest_value <= 0 then raise exception 'Payment amounts are invalid'; end if;
  if request_key is not null then select * into result from public.loan_payments where user_id=owner_id and idempotency_key=request_key; if found then return result; end if; end if;
  select * into loan_row from public.loans where id=loan_id_value and user_id=owner_id for update;
  if not found or loan_row.status <> 'active' then raise exception 'This loan is no longer active'; end if;
  if principal_value > loan_row.outstanding_principal then raise exception 'Principal payment exceeds the outstanding balance'; end if;
  select * into wallet_row from public.wallets where id=wallet_id_value and user_id=owner_id for update;
  if not found then raise exception 'Wallet is no longer available'; end if;
  if loan_row.direction='borrowed' then select coalesce(sum(amount),0) into allocated from public.goal_contributions where wallet_id=wallet_id_value and user_id=owner_id; if principal_value+interest_value > wallet_row.balance-allocated then raise exception 'The wallet does not have enough available funds for this payment'; end if; end if;
  insert into public.loan_payments(user_id,loan_id,wallet_id,principal_amount,interest_amount,paid_on,note,idempotency_key) values(owner_id,loan_id_value,wallet_id_value,principal_value,interest_value,coalesce(paid_on_value,current_date),nullif(trim(note_value),''),request_key) returning * into result;
  if interest_value > 0 and loan_row.direction='lent' then insert into public.income(user_id,wallet_id,source,type,amount,date,is_recurring) values(owner_id,wallet_id_value,'Loan interest from ' || loan_row.counterparty,'interest',interest_value,coalesce(paid_on_value,current_date),false) returning * into interest_income; update public.loan_payments set interest_income_id=interest_income.id where id=result.id returning * into result;
  elsif interest_value > 0 then insert into public.expenses(user_id,wallet_id,merchant,category,amount,date,payment_method) values(owner_id,wallet_id_value,'Loan interest to ' || loan_row.counterparty,'Debt / Loan',interest_value,coalesce(paid_on_value,current_date),'bank_transfer') returning * into interest_expense; update public.loan_payments set interest_expense_id=interest_expense.id where id=result.id returning * into result;
  end if;
  update public.loans set outstanding_principal=outstanding_principal-principal_value,status=case when outstanding_principal-principal_value=0 then 'paid' else 'active' end,updated_at=now() where id=loan_id_value;
  perform public.recompute_wallet_balance(wallet_id_value); return result;
exception when unique_violation then select * into result from public.loan_payments where user_id=owner_id and idempotency_key=request_key; return result;
end; $$;

create or replace function public.write_off_loan(loan_id_value uuid)
returns public.loans language plpgsql security definer set search_path = public as $$
declare owner_id uuid := auth.uid(); result public.loans; loan_row public.loans; loss_expense public.expenses;
begin
 if owner_id is null then raise exception 'Authentication is required'; end if;
 select * into loan_row from public.loans where id=loan_id_value and user_id=owner_id and status='active' for update;
 if not found then raise exception 'This loan is no longer active'; end if;
 if loan_row.direction <> 'lent' then raise exception 'Only money owed to you can be written off'; end if;
 insert into public.expenses(user_id, wallet_id, merchant, category, amount, date, payment_method)
 values(owner_id, null, 'Loan written off: ' || loan_row.counterparty, 'Debt / Loan', loan_row.outstanding_principal, current_date, 'other') returning * into loss_expense;
 update public.loans set status='written_off', writeoff_expense_id=loss_expense.id, written_off_at=now(), updated_at=now() where id=loan_id_value returning * into result;
 return result;
end; $$;

revoke all on function public.create_loan(uuid,text,text,numeric,text,numeric,numeric,date,date,text,text) from public;
revoke all on function public.record_loan_payment(uuid,uuid,numeric,numeric,date,text,text) from public;
revoke all on function public.write_off_loan(uuid) from public;
grant execute on function public.create_loan(uuid,text,text,numeric,text,numeric,numeric,date,date,text,text) to authenticated;
grant execute on function public.record_loan_payment(uuid,uuid,numeric,numeric,date,text,text) to authenticated;
grant execute on function public.write_off_loan(uuid) to authenticated;
