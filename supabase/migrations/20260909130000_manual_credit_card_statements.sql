-- Manual statements are authoritative only after the cardholder enters values
-- from the bank statement. No historical statements are generated here.
alter table public.credit_card_statements
  add column if not exists origin text not null default 'manual',
  add column if not exists note text,
  add column if not exists rate_used numeric,
  add column if not exists rate_basis_used text;
alter table public.credit_card_statements drop constraint if exists credit_card_statements_origin_check;
alter table public.credit_card_statements add constraint credit_card_statements_origin_check check (origin in ('manual', 'estimated', 'confirmed'));
alter table public.credit_card_statements drop constraint if exists credit_card_statements_rate_basis_used_check;
alter table public.credit_card_statements add constraint credit_card_statements_rate_basis_used_check check (rate_basis_used is null or rate_basis_used in ('annual', 'monthly'));

create or replace function public.create_credit_card_statement(
  target_credit_wallet_id uuid,
  period_start_value date,
  period_end_value date,
  closing_date_value date,
  due_date_value date,
  statement_balance_value numeric,
  minimum_due_value numeric,
  rate_used_value numeric,
  rate_basis_used_value text,
  note_value text
)
returns public.credit_card_statements
language plpgsql security definer set search_path = pg_catalog, public as $$
declare owner_id uuid := auth.uid(); card public.wallets; result public.credit_card_statements;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  if period_start_value > period_end_value or closing_date_value < period_end_value or due_date_value <= closing_date_value then
    raise exception 'Invalid statement dates';
  end if;
  if statement_balance_value < 0 or minimum_due_value < 0 or minimum_due_value > statement_balance_value
    or statement_balance_value <> trunc(statement_balance_value, 2) or minimum_due_value <> trunc(minimum_due_value, 2) then
    raise exception 'Invalid statement amount';
  end if;
  if rate_used_value is not null and (rate_used_value < 0 or rate_used_value > 100) then raise exception 'Invalid statement rate'; end if;
  if rate_basis_used_value is not null and rate_basis_used_value not in ('annual', 'monthly') then raise exception 'Invalid statement rate basis'; end if;
  select * into card from public.wallets where id = target_credit_wallet_id and user_id = owner_id and account_type = 'credit' for update;
  if not found then raise exception 'Credit card not found'; end if;
  insert into public.credit_card_statements(
    user_id, credit_wallet_id, period_start, period_end, closing_date, due_date,
    statement_balance, minimum_due, remaining_balance, status, origin, note,
    rate_used, rate_basis_used
  ) values (
    owner_id, card.id, period_start_value, period_end_value, closing_date_value, due_date_value,
    statement_balance_value, minimum_due_value, statement_balance_value, 'issued', 'manual',
    nullif(trim(note_value), ''), rate_used_value, rate_basis_used_value
  ) returning * into result;
  return result;
exception when unique_violation then
  raise exception 'A statement already exists for this card and period' using errcode = '23505';
end;
$$;

revoke all on function public.create_credit_card_statement(uuid, date, date, date, date, numeric, numeric, numeric, text, text) from public;
grant execute on function public.create_credit_card_statement(uuid, date, date, date, date, numeric, numeric, numeric, text, text) to authenticated;
notify pgrst, 'reload schema';
