import assert from "node:assert/strict";
import test from "node:test";
import { createIncomeSchema } from "./income.schema.js";

const baseIncome = {
  source: "Salary",
  type: "salary",
  amount: 30000,
  date: "2026-08-20",
  wallet_id: "57d26237-af65-4e71-9f43-97aa9fbc7919",
};

test("one-time income normalizes an empty frequency to null", () => {
  const result = createIncomeSchema.safeParse({
    ...baseIncome,
    is_recurring: false,
    frequency: "",
  });

  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.frequency, null);
});

test("recurring income requires a frequency", () => {
  const result = createIncomeSchema.safeParse({
    ...baseIncome,
    is_recurring: true,
    frequency: null,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0]?.message, "Select how often this income repeats.");
  }
});

test("one-time income cannot retain a recurrence frequency", () => {
  const result = createIncomeSchema.safeParse({
    ...baseIncome,
    is_recurring: false,
    frequency: "monthly",
  });

  assert.equal(result.success, false);
});

test("canonical income categories are accepted for one-time income", () => {
  const result = createIncomeSchema.safeParse({
    ...baseIncome,
    type: "allowance",
    is_recurring: false,
    frequency: null,
  });
  assert.equal(result.success, true);
});
