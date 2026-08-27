import assert from "node:assert/strict";
import test from "node:test";
import { expandIncomeRows, nextOccurrenceDate } from "./income-recurrence.service.js";

test("a future recurring schedule is projected, not an actual income row", () => {
  const schedule = { id: "schedule", source: "Salary", amount: 30000, date: "2026-08-28", is_recurring: true, frequency: "monthly", is_posted: false, schedule_status: "active" };
  const rows = expandIncomeRows([schedule], "2026-08-27", "2026-09-30");
  assert.equal(rows.length, 2);
  assert.equal(rows.every((row) => row.is_scheduled), true);
  assert.deepEqual(rows.map((row) => row.date).sort(), ["2026-08-28", "2026-09-28"]);
});

test("monthly occurrences clamp day 31 to the last day of shorter months", () => {
  const schedule = { id: "schedule", date: "2026-01-31", is_recurring: true, frequency: "monthly" };
  assert.equal(nextOccurrenceDate(schedule, "2026-02-01"), "2026-02-28");
  assert.equal(nextOccurrenceDate(schedule, "2028-02-01"), "2028-02-29");
});
