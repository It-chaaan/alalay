import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalExpenseRows } from './expense-rows.js';

test('a linked Bill expense remains one canonical Expenses row', () => {
  const rows = canonicalExpenseRows([
    {
      id: 'bill-expense',
      merchant: 'Meralco',
      amount: 5000,
      source_bill_id: 'meralco-template',
      payment_method: 'other',
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'expense');
  assert.equal(rows[0].id, 'bill-expense');
});
