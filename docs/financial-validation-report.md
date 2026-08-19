# Financial Validation Report

Date: 2026-08-19  
Scope: local Docker/Supabase only. No production connection, migration, or financial data mutation was performed.

## Security and ownership

The two-user local RLS suite verifies read isolation and rejects cross-user table writes plus transfer, bill-payment, goal-contribution, loan, and credit-repayment RPC attacks. Internal `SECURITY DEFINER` helper execution is restricted by [`20260819110000_security_definer_internal_acl.sql`](../supabase/migrations/20260819110000_security_definer_internal_acl.sql). Result: **PASS after local reset**.

## Canonical credit repayment

`repay_credit_account` and `credit_repayments` settle principal against a credit liability and the funding wallet atomically. Interest and fees become linked ordinary expenses; principal does not. The operation validates ownership, rejects credit-to-credit funding, prevents overpayment, accounts for goal allocations when checking available funds, and returns the existing row for an idempotency-key retry.

Credit-statement bills route through the same RPC and do not create a duplicate purchase expense. The web wallet cards, list, detail page, and bill form expose the operation. Mobile has the shared authenticated API helper and mutation invalidation contract; a dedicated mobile repayment sheet remains a parity follow-up because the existing mobile wallet sheet does not yet expose this action.

Result: **PASS in local SQL/RLS/workflow coverage**.

## Reports and budget

The canonical formula is:

`total expenses = ordinary expenses + paid bills`

`net savings = genuine income - total expenses`

Credit-statement bills are excluded from paid-bill spending because their purchases are already expense rows. Interest and fees remain spending. Transfer principal, lent/borrowed principal, goal allocations, and credit principal repayments remain balance-sheet movements. Deterministic reconciliation and precision tests pass.

## Migration reconciliation

Local reset succeeds with the replacement soft-delete migration, credit liability accounting, ACL hardening, and credit repayment migration.

- `20260818150001_fix_soft_delete_trigger_rls.sql`: `DE4B8E47A20F10E31C8A5790CA64B30F5F9DD2540961FC3812401596D1C638AA`
- `20260819100000_credit_wallet_liability_accounting.sql`: `66777080129DA09F23B502ED44F15DADC38369F6F3F2BE40E9E62703C3168975`
- `20260819110000_security_definer_internal_acl.sql`: `AB67A6BA254F8DA12590A69B86375EBCE6767D04A6A26EA7978727978F82B765`
- `20260819120000_credit_repayments.sql`: `7840DA507120614433B863D23E306E11985AA35EEF3E6F5842D3784231F1BF2E`

Before deployment, an operator must inspect the linked project without automatic repair:

```powershell
supabase link --project-ref <project-ref>
supabase migration list
supabase db diff --linked
```

If remote history contains either the old duplicate version or an equivalent soft-delete migration, reconcile the history and checksum with the deployment owner before applying later migrations. No remote history was inspected or altered.

## Frontend type safety

`frontend` standalone `tsc --noEmit`: **0 errors**. Financial forms now distinguish Zod input types from parsed output types, and the related income, category, dashboard-nullability, and UI accessibility errors are resolved. Test files are excluded from the application compiler and continue to run through the repository test harness.

## Final local validation

- `npm run test:db`: **4/4 passed**, including repayment atomicity, idempotency, overpayment rejection, credit-statement bill routing, and cross-user RLS
- `npm run test:contracts`: **10/10 passed**
- `npm run test:workflows`: **38/38 passed**
- Backend build: **passed**
- Frontend production build: **passed**, with the existing large-chunk warning
- Frontend strict typecheck: **passed**
- Mobile strict typecheck: **passed**
- Workflow parity audit: **passed**, 17 parity / 6 partial / 4 manual review
- `git diff --check`: **passed**

## Deployment decision

The local financial blockers covered here are closed. The application is not fully production-ready until the deployment owner reconciles remote migration history/checksums and completes the mobile repayment-surface parity review. No production database was inspected or changed.
