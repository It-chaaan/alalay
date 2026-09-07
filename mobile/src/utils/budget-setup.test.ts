import assert from 'node:assert/strict';

import { recommendedBudgetTemplate } from '@shared/budget-templates';
import {
  canApplyBudgetSetup,
  canStartBudgetSave,
  copiedBudgetEntries,
  previousBudgetMonth,
  recommendedBudgetEntries,
} from './budget-setup';

assert.equal(previousBudgetMonth('2026-01'), '2025-12');
assert.equal(previousBudgetMonth('2026-08'), '2026-07');

const copied = copiedBudgetEntries([
  { id: 'food', name: 'Food', budget: 2_500 },
  { id: 'goal', name: 'Emergency fund', budget: 1_000, goal: true },
  { id: 'transport', name: 'Transport', budget: 1_200, icon: 'car' },
]);
assert.deepEqual(copied, [
  { id: 'food', name: 'Food', budget: 2_500, icon: undefined, persisted: false },
  { id: 'transport', name: 'Transport', budget: 1_200, icon: 'car', persisted: false },
]);

const recommended = recommendedBudgetEntries({
  categories: [
    { id: 'food', name: 'Food', budget: 4_321 },
    { id: 'goal', name: 'Goal allocation', budget: 999, goal: true },
  ],
  template: recommendedBudgetTemplate,
  monthlyBudget: 12_345,
});
assert.equal(recommended.find((entry) => entry.name === 'Food')?.budget, 4_321);
assert.equal(recommended.find((entry) => entry.name === 'Rent')?.budget, 2_469);
assert.equal(recommended.find((entry) => entry.name === 'Savings')?.budget, 2_469);
assert.equal(recommended.some((entry) => entry.name === 'Goal allocation'), false);

assert.equal(
  canApplyBudgetSetup({ capturedMonth: '2026-08', activeMonth: '2026-08', dialogOpen: true }),
  true,
);
assert.equal(
  canApplyBudgetSetup({ capturedMonth: '2026-08', activeMonth: '2026-09', dialogOpen: true }),
  false,
);
assert.equal(
  canApplyBudgetSetup({ capturedMonth: '2026-08', activeMonth: '2026-08', dialogOpen: false }),
  false,
);
assert.equal(canStartBudgetSave(false), true);
assert.equal(canStartBudgetSave(true), false);

console.log('budget setup tests passed');
