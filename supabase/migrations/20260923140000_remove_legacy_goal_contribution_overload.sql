-- Current RPCs require occurrence/idempotency context. Keeping their legacy
-- exact overloads either makes defaulted calls ambiguous or bypasses the newer
-- accounting model. Production callers use the named current signatures.
drop function if exists public.add_goal_contribution(uuid, uuid, numeric);
drop function if exists public.mark_bill_paid(uuid, uuid, date);

notify pgrst, 'reload schema';
