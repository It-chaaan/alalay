-- REVOKE FROM PUBLIC does not remove grants made directly to API roles. Keep
-- incident-only and trigger/setup helpers inaccessible to client roles.
revoke all on function public.reconcile_auth_profile(uuid, uuid) from public, anon, authenticated, service_role;

revoke all on function public.ensure_default_cash_wallet(uuid) from public, anon, authenticated;
grant execute on function public.ensure_default_cash_wallet(uuid) to service_role;

revoke all on function public.recompute_wallet_balance(uuid) from public, anon, authenticated;
grant execute on function public.recompute_wallet_balance(uuid) to service_role;

revoke all on function public.recompute_wallet_balances() from public, anon, authenticated;
grant execute on function public.recompute_wallet_balances() to service_role;

revoke all on function public.validate_wallet_workflow() from public, anon, authenticated;
grant execute on function public.validate_wallet_workflow() to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

revoke all on function public.add_goal_contribution(uuid, uuid, numeric, date, text, text) from public, anon, service_role;
grant execute on function public.add_goal_contribution(uuid, uuid, numeric, date, text, text) to authenticated;

revoke all on function public.mark_bill_paid(uuid, uuid, date, date) from public, anon, service_role;
grant execute on function public.mark_bill_paid(uuid, uuid, date, date) to authenticated;

revoke all on function public.reconcile_bill_occurrences(uuid, date) from public, anon;
grant execute on function public.reconcile_bill_occurrences(uuid, date) to authenticated, service_role;
