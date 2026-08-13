import assert from "node:assert/strict";
import test from "node:test";
import { createBillSchema } from "./bill.schema.js";

const categories = [
  "Electricity", "Water", "Internet", "Rent", "Mobile / Phone", "Mortgage", "Gas",
  "Cable / TV", "Credit Card", "Loan", "Insurance", "Taxes", "HOA / Association",
  "Tuition / School", "Maintenance", "Other",
];

test("bill categories exposed by mobile are accepted as canonical category strings", () => {
  for (const category of categories) {
    assert.equal(createBillSchema.safeParse({
      title: "BDO", amount: 1000, category, due_date: "2026-08-20", recurring: false, frequency: null,
    }).success, true, category);
  }
});

test("bill schema remains strict and does not accept custom_category", () => {
  const result = createBillSchema.safeParse({
    title: "BDO", amount: 1000, category: "Credit Card", due_date: "2026-08-20",
    recurring: false, frequency: null, custom_category: "Credit Card",
  });
  assert.equal(result.success, false);
});
