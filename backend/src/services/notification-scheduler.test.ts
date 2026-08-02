import assert from "node:assert/strict";
import { shouldSendMonthlySummary, shouldSendReminder } from "./notification-scheduler.service.js";

assert.equal(shouldSendReminder(false, "2026-08-04", "2026-08-01", 3), false, "disabled reminder must not send");
assert.equal(shouldSendReminder(true, "2026-08-04", "2026-08-01", 3), true, "enabled reminder sends on its configured date");
assert.equal(shouldSendReminder(true, "2026-08-05", "2026-08-01", 3), false, "reminder must not send outside its configured date");
assert.equal(shouldSendMonthlySummary(false, "2026-08-01"), false, "disabled summary must not send");
assert.equal(shouldSendMonthlySummary(true, "2026-08-01"), true, "enabled summary sends on the first");
assert.equal(shouldSendMonthlySummary(true, "2026-08-02"), false, "summary must not send on other days");

console.log("notification scheduler preference tests passed");
