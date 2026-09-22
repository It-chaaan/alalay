import assert from 'node:assert/strict';
import test from 'node:test';
import { currencySeparator, formatCurrency } from './currency';

test('uses one canonical peso symbol and predictable display rounding', () => {
  assert.equal(formatCurrency(0), '\u20B10');
  assert.equal(formatCurrency(250), '\u20B1250');
  assert.equal(formatCurrency(1500), '\u20B11,500');
  assert.equal(formatCurrency(156840), '\u20B1156,840');
  assert.equal(formatCurrency(-250), '-\u20B1250');
  assert.equal(formatCurrency(250.5), '\u20B1250.50');
  assert.equal(formatCurrency('250.567'), '\u20B1250.57');
  assert.equal(formatCurrency('₱1,250.50'), '\u20B11,250.50');
  assert.equal(formatCurrency('−₱250'), '-\u20B1250');
  assert.equal(formatCurrency('invalid'), '\u20B10');
});

test('uses the canonical visual separator', () => {
  assert.equal(currencySeparator, '\u00B7');
  assert.equal(`Electricity ${currencySeparator} Due Sep 1`, 'Electricity · Due Sep 1');
  assert.equal(`Subscription ${currencySeparator} Renews Sep 2`, 'Subscription · Renews Sep 2');
});

test('preserves Unicode values through API-style JSON serialization', () => {
  const payload = {
    name: 'Meralco Ñ',
    label: `Electricity ${currencySeparator} Due`,
    amount: formatCurrency(5000),
  };
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), payload);
});

test('Dashboard wallet amounts contain exactly one peso symbol', () => {
  for (const value of [83000, 1250.5, -250]) {
    const formatted = formatCurrency(value);
    assert.equal((formatted.match(/₱/gu) ?? []).length, 1);
    assert.doesNotMatch(formatted, /[\uFFFD]/u);
  }
  assert.equal(formatCurrency(83000), '₱83,000');
  assert.equal(formatCurrency(1250.5), '₱1,250.50');
});
