import assert from "node:assert/strict";
import test from "node:test";
import { formatIncomeRecurrence } from "./incomeRecurrence";

test("one-time income has no recurrence suffix", () => {
  assert.equal(formatIncomeRecurrence({ is_recurring: false, frequency: null }), null);
});

test("recurring income uses its canonical frequency", () => {
  assert.equal(formatIncomeRecurrence({ is_recurring: true, frequency: "monthly" }), "/mo");
  assert.equal(formatIncomeRecurrence({ is_recurring: true, frequency: "weekly" }), "/week");
  assert.equal(formatIncomeRecurrence({ is_recurring: true, frequency: "biweekly" }), "/2 weeks");
  assert.equal(formatIncomeRecurrence({ is_recurring: true, frequency: "yearly" }), "/year");
});

test("malformed recurring data does not invent a monthly label", () => {
  assert.equal(formatIncomeRecurrence({ is_recurring: true, frequency: undefined }), "Recurring");
});
