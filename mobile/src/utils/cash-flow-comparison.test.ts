import assert from 'node:assert/strict';
import test from 'node:test';
import { cashFlowComparison } from './cash-flow-comparison';

test('uses one shared scale for Income 12000 and Spending 7127', () => {
  const comparison = cashFlowComparison(12000, 7127);
  assert.equal(comparison.scaleMax, 12000);
  assert.equal(comparison.incomeRatio, 1);
  assert.ok(Math.abs(comparison.spendingRatio - 0.5939166667) < 0.000001);
});

test('handles equal, one-sided, zero, decimal, and larger-spending comparisons', () => {
  assert.deepEqual(cashFlowComparison(5, 5), {
    income: 5,
    spending: 5,
    scaleMax: 5,
    incomeRatio: 1,
    spendingRatio: 1,
  });
  assert.deepEqual(cashFlowComparison(20, 0), {
    income: 20,
    spending: 0,
    scaleMax: 20,
    incomeRatio: 1,
    spendingRatio: 0,
  });
  assert.deepEqual(cashFlowComparison(0, 20), {
    income: 0,
    spending: 20,
    scaleMax: 20,
    incomeRatio: 0,
    spendingRatio: 1,
  });
  assert.deepEqual(cashFlowComparison(0, 0), {
    income: 0,
    spending: 0,
    scaleMax: 0,
    incomeRatio: 0,
    spendingRatio: 0,
  });
  assert.equal(cashFlowComparison(123.45, 67.89).spendingRatio, 67.89 / 123.45);
  assert.deepEqual(cashFlowComparison(2, 8), {
    income: 2,
    spending: 8,
    scaleMax: 8,
    incomeRatio: 0.25,
    spendingRatio: 1,
  });
});

test('does not produce a misleading width for malformed values', () => {
  assert.deepEqual(cashFlowComparison(Number.NaN, Infinity), {
    income: 0,
    spending: 0,
    scaleMax: 0,
    incomeRatio: 0,
    spendingRatio: 0,
  });
  assert.deepEqual(cashFlowComparison(-1, 10), {
    income: 0,
    spending: 10,
    scaleMax: 10,
    incomeRatio: 0,
    spendingRatio: 1,
  });
});
