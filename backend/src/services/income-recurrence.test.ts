import assert from "node:assert/strict";
import { expandIncomeRows } from "./income-recurrence.service.js";

const rows = expandIncomeRows([
  { id: "salary", source: "Salary", amount: 30000, date: "2026-07-03", is_recurring: true, frequency: "monthly" },
  { id: "freelance", source: "Freelance", amount: 15000, date: "2026-07-12", is_recurring: "true", frequency: "Monthly" },
], "2026-08-01", "2026-08-31");

assert.deepEqual(rows.map((row) => [row.date, row.amount, row.is_scheduled]), [
  ["2026-08-12", 15000, true],
  ["2026-08-03", 30000, true],
]);

const recorded = expandIncomeRows([
  { id: "salary", source: "Salary", amount: 30000, date: "2026-07-03", is_recurring: true, frequency: "monthly" },
  { id: "salary-august", source: "Salary", amount: 30000, date: "2026-08-03", is_recurring: false },
], "2026-08-01", "2026-08-31");

assert.equal(recorded.length, 1, "an actual occurrence must suppress its scheduled duplicate");
assert.equal(recorded[0].date, "2026-08-03");
assert.equal(recorded[0].is_scheduled, undefined);

const malformed = expandIncomeRows([
  { id: "legacy", source: "Allowance", amount: 5000, date: "2026-07-23", is_recurring: true, frequency: null },
], "2026-08-01", "2026-08-31");
assert.equal(malformed.length, 0, "missing recurrence frequency must not be forecast monthly");

console.log("income recurrence regression tests passed");
