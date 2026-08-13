import assert from "node:assert/strict";
import { categoryDefinitions, getCategoryMeta } from "./categoryRegistry";

const requiredLabels = [
  "Essentials", "Food", "Groceries", "Transport", "Housing / Rent", "Utilities", "Bills", "Healthcare",
  "Education", "Lifestyle", "Shopping", "Dining Out", "Entertainment", "Travel", "Personal Care", "Fitness",
  "Financial / Other", "Subscriptions", "Insurance", "Debt / Loan", "Gifts / Donations", "Family", "Pets", "Other",
];

assert.ok(categoryDefinitions.length >= 60, "the expanded catalog should remain comprehensive");
for (const label of requiredLabels) {
  const category = getCategoryMeta(label);
  assert.equal(category.label, label, `${label} should remain a canonical category`);
  assert.notEqual(category.iconKey, "ellipsis", `${label} must not use the generic ellipsis icon`);
}

const legacy = getCategoryMeta("Archived legacy category");
assert.equal(legacy.iconKey, "tag", "unknown historical categories must retain a safe fallback");

console.log("category registry tests passed");
