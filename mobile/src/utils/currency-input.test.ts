import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCurrencyInput } from './currency-input';

test('formats whole peso amounts with grouping', () => {
  assert.equal(formatCurrencyInput('5000'), '5,000');
  assert.equal(formatCurrencyInput('₱12,500.50'), '12,500.50');
});

test('keeps a decimal in progress and rejects invalid characters', () => {
  assert.equal(formatCurrencyInput('12500.'), '12,500.');
  assert.equal(formatCurrencyInput('12abc.345'), '12.34');
  assert.equal(formatCurrencyInput(''), '');
});
