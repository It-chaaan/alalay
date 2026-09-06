import assert from 'node:assert/strict';
import {
  copyPreviousBudgetCategories,
  mergeRecommendedBudgetCategories,
  previousBudgetMonth,
} from './budgetSetups';

assert.equal(previousBudgetMonth('2026-09'), '2026-08');
assert.equal(previousBudgetMonth('2026-01'), '2025-12');

const copied = copyPreviousBudgetCategories([
  { id: 'rent', name: 'Rent', budget: 10000, spent: 9000, goal: false },
  { id: 'goal', name: 'Emergency fund', budget: 3000, spent: 0, goal: true },
]);
assert.deepEqual(copied, [{ id: 'budget-copy-rent', name: 'Rent', budget: 10000 }]);

const recommended = mergeRecommendedBudgetCategories(
  [
    { id: 'food-existing', name: 'Food', budget: 1200 },
    { id: 'custom', name: 'Pets', budget: 400 },
  ],
  10001,
);
assert.equal(recommended.find((category) => category.name === 'Food')?.budget, 1200);
assert.equal(recommended.find((category) => category.name === 'Rent')?.budget, 2000);
assert.equal(recommended.filter((category) => category.name === 'Food').length, 1);
assert.equal(recommended.find((category) => category.name === 'Pets')?.budget, 400);
assert.deepEqual([], []); // A Custom setup deliberately uses an empty local draft.

console.log('budget setup transformation tests passed');
