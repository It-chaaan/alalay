import assert from "node:assert/strict";
import { createLoanSchema, loanPaymentSchema } from "./loan.schema.js";

const key = "loan-request-key-0001";
assert.equal(createLoanSchema.safeParse({ wallet_id: "00000000-0000-4000-8000-000000000001", direction: "lent", counterparty: "Ana", principal: 5000, interest_type: "none", idempotency_key: key }).success, true);
assert.equal(createLoanSchema.safeParse({ wallet_id: "00000000-0000-4000-8000-000000000001", direction: "borrowed", counterparty: "Bank", principal: 5000, interest_type: "simple", idempotency_key: key }).success, false);
assert.equal(createLoanSchema.safeParse({ wallet_id: "00000000-0000-4000-8000-000000000001", direction: "borrowed", counterparty: "Bank", principal: 5000, interest_type: "fixed", fixed_interest_amount: 100, idempotency_key: key }).success, true);
assert.equal(loanPaymentSchema.safeParse({ wallet_id: "00000000-0000-4000-8000-000000000001", principal_amount: 0, interest_amount: 0, idempotency_key: key }).success, false);
console.log("loan schema tests passed");
