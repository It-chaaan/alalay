import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCanonicalSpending } from './analytics.service.js';

test('canonical spending counts a paid bill once and preserves centavo precision', () => {
  const result = calculateCanonicalSpending(
    [
      { amount: 1000, source_bill_id: null },
      { amount: 500, source_bill_id: null },
      { amount: 15, source_bill_id: null },
      { amount: 2000, source_bill_id: 'paid-bill-id' },
      { amount: 0.01, source_bill_id: null },
      { amount: 0.1, source_bill_id: null },
      { amount: 1.25, source_bill_id: null },
      { amount: 10.99, source_bill_id: null },
    ],
    [{ amount: 2000 }],
    30000,
  );

  assert.deepEqual(result, {
    ordinary_expenses: 1527.35,
    paid_bills: 2000,
    total_expenses: 3527.35,
    net_savings: 26472.65,
  });
});

test('a paid-bill-linked expense is not added again as ordinary spending', () => {
  const result = calculateCanonicalSpending(
    [
      { amount: 1000, source_bill_id: null },
      { amount: 1000, source_bill_id: 'credit-payment-not-a-bill' },
    ],
    [],
    0,
  );

  assert.equal(result.total_expenses, 1000);
  assert.equal(result.net_savings, -1000);
});

test('credit statement settlement is excluded when the purchase is already an expense', () => {
  const result = calculateCanonicalSpending(
    [{ amount: 1500, source_bill_id: null }],
    [{ amount: 1500, credit_wallet_id: 'credit-wallet-id' }],
    0,
  );

  assert.equal(result.ordinary_expenses, 1500);
  assert.equal(result.paid_bills, 0);
  assert.equal(result.total_expenses, 1500);
});

test('report reconciliation includes genuine spending but excludes balance-sheet movements', () => {
  const result = calculateCanonicalSpending(
    [
      { amount: 1000, source_bill_id: null }, // Food
      { amount: 500, source_bill_id: null }, // Transport
      { amount: 15, source_bill_id: null }, // Transfer fee
      { amount: 50, source_bill_id: null }, // Interest paid
      { amount: 1500, source_bill_id: null }, // Credit purchase
      { amount: 2000, source_bill_id: 'paid-bill-id' }, // Bill payment expense mirror
    ],
    [{ amount: 2000 }],
    30100, // Salary plus interest received
  );

  // Transfer principal, lent/borrowed principal, goal allocation, and credit
  // principal repayment are not expense or income rows in the canonical model.
  assert.equal(result.total_expenses, 5065);
  assert.equal(result.net_savings, 25035);
});
