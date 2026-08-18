import assert from "node:assert/strict";
import test from "node:test";
import { createExpenseSchema } from "./expense.schema.js";

const baseExpense = {
  merchant: "Mercury Drug",
  amount: 43,
  category: "Essentials",
  date: "2026-08-18",
  wallet_id: "57d26237-af65-4e71-9f43-97aa9fbc7919",
};

test("expenses use the selected wallet as their payment source", () => {
  const result = createExpenseSchema.safeParse(baseExpense);

  assert.equal(result.success, true);
});

test("expenses reject requests without a payment wallet", () => {
  const result = createExpenseSchema.safeParse(baseExpense);

  assert.equal(result.success, true);
  const missingWallet = { ...baseExpense } as Record<string, unknown>;
  delete missingWallet.wallet_id;
  assert.equal(createExpenseSchema.safeParse(missingWallet).success, false);
});
