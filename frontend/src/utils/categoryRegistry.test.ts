import assert from 'node:assert/strict';
import { incomeCategoryDefinitions } from '../../../shared/category-registry';
import { categoryDefinitions, getCategoryMeta } from './categoryRegistry';

const requiredLabels = [
  'Essentials',
  'Food',
  'Groceries',
  'Transport',
  'Housing / Rent',
  'Utilities',
  'Bills',
  'Healthcare',
  'Education',
  'Lifestyle',
  'Shopping',
  'Dining Out',
  'Entertainment',
  'Travel',
  'Personal Care',
  'Fitness',
  'Financial / Other',
  'Subscriptions',
  'Insurance',
  'Debt / Loan',
  'Gifts / Donations',
  'Family',
  'Pets',
  'Other',
];

assert.ok(categoryDefinitions.length >= 60, 'the expanded catalog should remain comprehensive');
const allSystemCategories = [...categoryDefinitions, ...incomeCategoryDefinitions];
assert.equal(
  new Set(allSystemCategories.map((category) => category.key)).size,
  allSystemCategories.length,
  'system keys must be unique',
);
assert.equal(
  new Set(allSystemCategories.map((category) => category.color)).size,
  allSystemCategories.length,
  'system colors must be unique',
);
assert.ok(
  allSystemCategories.every((category) => category.isSystem && category.isActive),
  'system metadata flags must be set',
);
assert.ok(
  allSystemCategories.every((category) => category.transactionTypes.length > 0),
  'categories must declare transaction types',
);
for (const label of requiredLabels) {
  const category = getCategoryMeta(label);
  assert.equal(category.label, label, `${label} should remain a canonical category`);
  assert.notEqual(category.iconKey, 'ellipsis', `${label} must not use the generic ellipsis icon`);
}

const legacy = getCategoryMeta('Archived legacy category');
assert.equal(legacy.iconKey, 'shapes', 'unknown historical categories must retain a safe fallback');

console.log('category registry tests passed');
