-- These SECURITY DEFINER routines are trigger/setup helpers. They accept
-- identifiers that are not user-scoped, so they must not be callable by API
-- roles. Trigger execution is unaffected; the backend service role retains
-- explicit access where direct server-side invocation is required.
revoke all on function public.ensure_default_cash_wallet(uuid) from public;
grant execute on function public.ensure_default_cash_wallet(uuid) to service_role;

revoke all on function public.recompute_wallet_balance(uuid) from public;
grant execute on function public.recompute_wallet_balance(uuid) to service_role;

revoke all on function public.recompute_wallet_balances() from public;
grant execute on function public.recompute_wallet_balances() to service_role;

revoke all on function public.sync_bill_expense() from public;
grant execute on function public.sync_bill_expense() to service_role;

revoke all on function public.validate_goal_preferred_wallet() from public;
grant execute on function public.validate_goal_preferred_wallet() to service_role;

revoke all on function public.validate_wallet_owner() from public;
grant execute on function public.validate_wallet_owner() to service_role;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to service_role;

revoke all on function public.delete_wallet(uuid) from public;
grant execute on function public.delete_wallet(uuid) to authenticated;
