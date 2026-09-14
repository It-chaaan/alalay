-- Loan principal changes and deletion are safe only before repayment history exists.
-- Keeping these operations in RPCs preserves the wallet balance invariant.
create or replace function public.update_loan(loan_id_value uuid, counterparty_value text, principal_value numeric, interest_type_value text, interest_rate_value numeric, fixed_interest_value numeric, start_date_value date, due_date_value date, notes_value text)
returns public.loans language plpgsql security definer set search_path = public as $$
declare owner_id uuid := auth.uid(); loan_row public.loans; result public.loans; allocated numeric;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  select * into loan_row from public.loans where id=loan_id_value and user_id=owner_id for update;
  if not found then raise exception 'Loan was not found'; end if;
  if exists(select 1 from public.loan_payments where loan_id=loan_id_value) then raise exception 'Loans with repayment history cannot be edited'; end if;
  if loan_row.status <> 'active' then raise exception 'Only active loans can be edited'; end if;
  if principal_value <= 0 or due_date_value < start_date_value then raise exception 'Invalid loan details'; end if;
  if interest_type_value not in ('none','fixed','simple') then raise exception 'Invalid interest type'; end if;
  if (interest_type_value='fixed' and coalesce(fixed_interest_value,0)<=0) or (interest_type_value='simple' and coalesce(interest_rate_value,0)<=0) then raise exception 'Invalid interest'; end if;
  if loan_row.direction='lent' and principal_value > loan_row.original_principal then
    select coalesce(sum(amount),0) into allocated from public.goal_contributions where wallet_id=loan_row.wallet_id and user_id=owner_id;
    if principal_value-loan_row.original_principal > (select balance from public.wallets where id=loan_row.wallet_id)-allocated then raise exception 'The wallet does not have enough available funds to lend this amount'; end if;
  end if;
  update public.loans set counterparty=trim(counterparty_value), original_principal=principal_value, outstanding_principal=principal_value, interest_type=interest_type_value, interest_rate=case when interest_type_value='simple' then interest_rate_value else null end, fixed_interest_amount=case when interest_type_value='fixed' then fixed_interest_value else null end, start_date=start_date_value, due_date=due_date_value, notes=nullif(trim(notes_value),''), updated_at=now() where id=loan_id_value returning * into result;
  perform public.recompute_wallet_balance(loan_row.wallet_id); return result;
end; $$;

create or replace function public.delete_loan(loan_id_value uuid)
returns void language plpgsql security definer set search_path = public as $$
declare owner_id uuid := auth.uid(); loan_row public.loans;
begin
  if owner_id is null then raise exception 'Authentication is required'; end if;
  select * into loan_row from public.loans where id=loan_id_value and user_id=owner_id for update;
  if not found then raise exception 'Loan was not found'; end if;
  if exists(select 1 from public.loan_payments where loan_id=loan_id_value) then raise exception 'Loans with repayment history cannot be deleted'; end if;
  delete from public.loans where id=loan_id_value; perform public.recompute_wallet_balance(loan_row.wallet_id);
end; $$;

revoke all on function public.update_loan(uuid,text,numeric,text,numeric,numeric,date,date,text) from public;
revoke all on function public.delete_loan(uuid) from public;
grant execute on function public.update_loan(uuid,text,numeric,text,numeric,numeric,date,date,text) to authenticated;
grant execute on function public.delete_loan(uuid) to authenticated;
