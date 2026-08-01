import assert from "node:assert/strict";
import { getNextSubscriptionRenewalDate } from "./subscriptionRenewal";

assert.equal(getNextSubscriptionRenewalDate("2026-08-01", "monthly", "2026-08-01"), "2026-08-01");
assert.equal(getNextSubscriptionRenewalDate("2026-07-12", "monthly", "2026-08-01"), "2026-08-12");
assert.equal(getNextSubscriptionRenewalDate("2026-01-15", "monthly", "2026-08-01"), "2026-08-15");
assert.equal(getNextSubscriptionRenewalDate("2025-08-01", "yearly", "2026-08-01"), "2026-08-01");
assert.equal(getNextSubscriptionRenewalDate("2025-01-31", "monthly", "2025-04-01"), "2025-04-28");

console.log("subscription renewal date tests passed");
