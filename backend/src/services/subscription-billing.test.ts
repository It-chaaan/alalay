import assert from "node:assert/strict";
import { addBillingCycle, dueOccurrences, projectWalletFundingWarnings } from "./subscription-billing.service.js";

assert.equal(addBillingCycle("2026-08-03", "weekly"), "2026-08-10");
assert.equal(addBillingCycle("2026-08-03", "monthly"), "2026-09-03");
assert.equal(addBillingCycle("2026-08-03", "quarterly"), "2026-11-03");
assert.equal(addBillingCycle("2026-08-03", "yearly"), "2027-08-03");

assert.deepEqual(dueOccurrences("2026-08-03", "monthly", "2026-08-08"), ["2026-08-03"]);
assert.deepEqual(dueOccurrences("2026-06-03", "monthly", "2026-08-08"), ["2026-06-03", "2026-07-03", "2026-08-03"]);

const warnings = projectWalletFundingWarnings([
  { id: "spotify", name: "Spotify", amount: 80, renewal_date: "2026-08-12", billing_cycle: "monthly", wallet_id: "gcash" },
  { id: "netflix", name: "Netflix", amount: 250, renewal_date: "2026-08-12", billing_cycle: "monthly", wallet_id: "gcash" },
  { id: "chatgpt", name: "ChatGPT", amount: 1500, renewal_date: "2026-08-12", billing_cycle: "monthly", wallet_id: "gcash" },
], new Map([["gcash", 500]]), "2026-08-09");
assert.equal(warnings.length, 1);
assert.equal(warnings[0].total, 1830);
assert.equal(warnings[0].shortfall, 1330);

const sufficient = projectWalletFundingWarnings([
  { id: "spotify", name: "Spotify", amount: 80, renewal_date: "2026-08-12", billing_cycle: "monthly", wallet_id: "gcash" },
  { id: "netflix", name: "Netflix", amount: 250, renewal_date: "2026-08-12", billing_cycle: "monthly", wallet_id: "gcash" },
], new Map([["gcash", 500]]), "2026-08-09");
assert.equal(sufficient.length, 0);

console.log("subscription billing date tests passed");
