import assert from "node:assert/strict";
import test from "node:test";
import { aggregateIncomeSources, formatIncomeRecurrence } from "./incomeRecurrence";
import type { IncomeEntry } from "../hooks/types";

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

const income = (overrides: Partial<IncomeEntry>): IncomeEntry => ({
  id: "income",
  source: "Allowance",
  type: "allowance",
  amount: 5000,
  date: "2026-08-18",
  is_recurring: false,
  created_at: "2026-08-18T00:00:00.000Z",
  ...overrides,
});

test("one-time source history has no monthly suffix", () => {
  const [source] = aggregateIncomeSources([
    income({ id: "one-time-a" }),
    income({ id: "one-time-b", amount: 3000 }),
  ]);

  assert.equal(source?.amount, 8000);
  assert.equal(formatIncomeRecurrence(source!), null);
});

test("recurring source history preserves its canonical frequency", () => {
  const [source] = aggregateIncomeSources([
    income({ id: "monthly-a", is_recurring: true, frequency: "monthly" }),
    income({ id: "monthly-b", amount: 15000, is_recurring: true, frequency: "monthly" }),
  ]);

  assert.equal(source?.amount, 20000);
  assert.equal(formatIncomeRecurrence(source!), "/mo");
});

test("mixed source history is not falsely labeled recurring", () => {
  const [source] = aggregateIncomeSources([
    income({ id: "one-time" }),
    income({ id: "monthly", is_recurring: true, frequency: "monthly" }),
  ]);

  assert.equal(formatIncomeRecurrence(source!), null);
});
