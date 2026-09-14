import assert from 'node:assert/strict';
import { budgetCategoryStatus } from './budgetCategoryStatus.js';

assert.equal(budgetCategoryStatus(0, 1000).status, 'no_spending');
assert.equal(budgetCategoryStatus(250, 1000).status, 'on_track');
assert.equal(budgetCategoryStatus(750, 1000).status, 'near_limit');
assert.equal(budgetCategoryStatus(1000, 1000).status, 'fully_used');
assert.equal(budgetCategoryStatus(1500, 1000).status, 'over_budget');
assert.equal(budgetCategoryStatus(0, 0).status, 'unallocated');
assert.equal(budgetCategoryStatus(1, 0).status, 'over_budget');
console.log('budget category status tests passed');
