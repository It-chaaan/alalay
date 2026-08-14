import assert from 'node:assert/strict';
import { budgetProgressPercent, budgetUsagePercent } from './budget-summary';

assert.equal(budgetUsagePercent(0, 0), 0);
assert.equal(budgetUsagePercent(0, 10000), 0);
assert.equal(budgetUsagePercent(10000, 10000), 100);
assert.equal(budgetUsagePercent(12000, 10000), 120);
assert.equal(budgetProgressPercent(12000, 10000), 100);
assert.equal(budgetProgressPercent(-100, 10000), 0);

console.log('budget summary tests passed');
