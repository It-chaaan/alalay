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
