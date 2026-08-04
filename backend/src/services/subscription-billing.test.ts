import assert from "node:assert/strict";
import { addBillingCycle, dueOccurrences } from "./subscription-billing.service.js";

assert.equal(addBillingCycle("2026-08-03", "weekly"), "2026-08-10");
assert.equal(addBillingCycle("2026-08-03", "monthly"), "2026-09-03");
assert.equal(addBillingCycle("2026-08-03", "quarterly"), "2026-11-03");
assert.equal(addBillingCycle("2026-08-03", "yearly"), "2027-08-03");

assert.deepEqual(dueOccurrences("2026-08-03", "monthly", "2026-08-08"), ["2026-08-03"]);
assert.deepEqual(dueOccurrences("2026-06-03", "monthly", "2026-08-08"), ["2026-06-03", "2026-07-03", "2026-08-03"]);

console.log("subscription billing date tests passed");
