import assert from 'node:assert/strict';

import {
  canApplyExpenseResponse,
  canStartExpenseSave,
  expenseCentavos,
  expenseDeleteRequestIntent,
  expenseRequestIntent,
  groupExpenseRows,
  walletAvailableForExpense,
} from './expense-screen';

assert.deepEqual(expenseRequestIntent(), { path: '/api/expenses', method: 'POST' });
assert.deepEqual(expenseRequestIntent('expense-1'), { path: '/api/expenses/expense-1', method: 'PATCH' });
assert.deepEqual(expenseDeleteRequestIntent('expense-1'), { path: '/api/expenses/expense-1', method: 'DELETE' });
assert.equal(canStartExpenseSave(false), true);
assert.equal(canStartExpenseSave(true), false);
assert.equal(expenseCentavos('10.105'), 1011);
assert.equal(expenseCentavos('not-a-number'), 0);
assert.equal(canApplyExpenseResponse({ requestId: 2, currentRequestId: 2, focused: true }), true);
assert.equal(canApplyExpenseResponse({ requestId: 2, currentRequestId: 3, focused: true }), false);
assert.equal(canApplyExpenseResponse({ requestId: 2, currentRequestId: 2, focused: false }), false);

const groups = groupExpenseRows([
  { id: 'old', date: '2026-08-02', amount: '10.10', created_at: '2026-08-02T09:00:00Z' },
  { id: 'new', date: '2026-08-02', amount: '0.20', created_at: '2026-08-02T10:00:00Z' },
  { id: 'previous', date: '2026-08-01', amount: 5 },
]);
assert.deepEqual(groups.map((group) => group.date), ['2026-08-02', '2026-08-01']);
assert.equal(groups[0].subtotal, 10.3);
assert.deepEqual(groups[0].items.map((item) => item.id), ['new', 'old']);

assert.equal(walletAvailableForExpense({ balance: 1_000, available_balance: 650 }), 650);
assert.equal(walletAvailableForExpense({ balance: 1_000 }), 1_000);

console.log('expense screen tests passed');
