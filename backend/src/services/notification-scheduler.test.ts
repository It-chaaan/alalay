import assert from "node:assert/strict";
import { billReminder, shouldSendMonthlySummary, shouldSendReminder } from "./notification-scheduler.service.js";

const reminderPrefs = { bill_reminders: true, bill_reminder_days: 3, bill_reminder_three_days: true, bill_reminder_one_day: true, bill_reminder_due_day: true, bill_overdue_reminders: true, subscription_reminders: true, summaries: false, overspending_alerts: true };

assert.equal(shouldSendReminder(false, "2026-08-04", "2026-08-01", 3), false, "disabled reminder must not send");
assert.equal(shouldSendReminder(true, "2026-08-04", "2026-08-01", 3), true, "enabled reminder sends on its configured date");
assert.equal(shouldSendReminder(true, "2026-08-05", "2026-08-01", 3), false, "reminder must not send outside its configured date");
assert.deepEqual(billReminder({ due_date: "2026-08-14" }, reminderPrefs, "2026-08-14"), { type: "bill_due", days: 0 }, "due-day reminders must fire on the due date");
assert.deepEqual(billReminder({ due_date: "2026-08-14" }, reminderPrefs, "2026-08-13"), { type: "bill_due", days: 1 }, "one-day reminders must use the canonical date-only comparison");
assert.deepEqual(billReminder({ due_date: "2026-08-14" }, reminderPrefs, "2026-08-15"), { type: "bill_overdue" }, "overdue policy must be restrained to one first-day reminder");
assert.equal(shouldSendMonthlySummary(false, "2026-08-01"), false, "disabled summary must not send");
assert.equal(shouldSendMonthlySummary(true, "2026-08-01"), true, "enabled summary sends on the first");
assert.equal(shouldSendMonthlySummary(true, "2026-08-02"), false, "summary must not send on other days");

console.log("notification scheduler preference tests passed");
