import assert from "node:assert/strict";
import test from "node:test";
import { budgetSchema } from "./budget.schema.js";

test("budget endpoint rejects unknown fields and invalid money precision", () => {
  const result = budgetSchema.safeParse({
    categories: [{ id: "food", name: "Food", budget: 10.001 }],
    unexpected: true,
  });
  assert.equal(result.success, false);
});

test("budget accepts month keys for distribution metadata", () => {
  assert.equal(budgetSchema.safeParse({
    categories: [{ id: "savings", name: "Savings", budget: 1000, last_distributed_month: "2026-08" }],
  }).success, true);
  assert.equal(budgetSchema.safeParse({
    categories: [{ id: "savings", name: "Savings", budget: 1000, last_distributed_month: "2026-08-01" }],
  }).success, false);
  assert.equal(budgetSchema.safeParse({
    categories: [{ id: "savings", name: "Savings", budget: 1000, last_distributed_month: null }],
  }).success, true);
});
