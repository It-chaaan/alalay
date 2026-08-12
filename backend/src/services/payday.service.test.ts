import assert from "node:assert/strict";
import { nextOccurrenceDate } from "./income-recurrence.service.js";

const salary = { id: "salary", source: "Accenture Payroll", type: "salary", amount: 30000, date: "2026-07-03", is_recurring: true, frequency: "monthly" };
const freelance = { id: "freelance", source: "Virtual Assistant", type: "freelance", amount: 15000, date: "2026-07-03", is_recurring: true, frequency: "monthly" };
const allowance = { id: "allowance", source: "Allowance", type: "salary", amount: 5000, date: "2026-07-23", is_recurring: false, frequency: null };

assert.equal(nextOccurrenceDate(salary, "2026-08-12"), "2026-09-03");
assert.equal(nextOccurrenceDate(salary, "2026-07-03"), "2026-07-03");
assert.equal(nextOccurrenceDate(freelance, "2026-08-12"), "2026-09-03");
assert.equal(allowance.is_recurring, false);
console.log("payday recurrence regression tests passed");
