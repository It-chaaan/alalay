import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBillCategory, resolveBillIcon } from './bill-icon';

test('resolves supported categories, including Cable / TV', () => {
  assert.deepEqual(resolveBillIcon({ name: 'Meralco', category: 'Electricity' }), {
    kind: 'icon',
    name: 'electricity',
  });
  assert.deepEqual(resolveBillIcon({ name: 'Maynilad', category: 'Water' }), {
    kind: 'icon',
    name: 'water',
  });
  assert.deepEqual(resolveBillIcon({ name: 'PLDT', category: 'Internet' }), {
    kind: 'icon',
    name: 'internet',
  });
  assert.deepEqual(resolveBillIcon({ name: 'Sky', category: 'Cable / TV' }), {
    kind: 'icon',
    name: 'cable',
  });
  assert.deepEqual(resolveBillIcon({ name: 'Apartment', category: 'Rent' }), {
    kind: 'icon',
    name: 'rent',
  });
  assert.deepEqual(resolveBillIcon({ name: 'Netflix', category: 'Subscription' }), {
    kind: 'icon',
    name: 'subscription',
  });
  assert.deepEqual(resolveBillIcon({ name: 'Globe', category: 'Phone' }), {
    kind: 'icon',
    name: 'phone',
  });
  assert.deepEqual(resolveBillIcon({ name: 'Life', category: 'Insurance' }), {
    kind: 'icon',
    name: 'insurance',
  });
  assert.deepEqual(resolveBillIcon({ name: 'Loan', category: 'Debt' }), {
    kind: 'icon',
    name: 'loan',
  });
});

test('uses explicit icon, then custom category, then provider, then name fallback', () => {
  assert.deepEqual(resolveBillIcon({ name: 'Custom', icon: 'water', category: 'Rent' }), {
    kind: 'icon',
    name: 'water',
  });
  assert.deepEqual(
    resolveBillIcon({ name: 'Custom', customCategory: 'Apartment', category: 'Other' }),
    { kind: 'icon', name: 'rent' },
  );
  assert.deepEqual(
    resolveBillIcon({ name: 'Meralco', category: 'Other', providerKey: 'meralco' }),
    { kind: 'provider', name: 'meralco' },
  );
  assert.deepEqual(resolveBillIcon({ name: '  sky ', category: 'Unknown' }), {
    kind: 'initial',
    name: 'S',
  });
  assert.deepEqual(resolveBillIcon({ name: '   ', category: 'Unknown' }), {
    kind: 'initial',
    name: '?',
  });
});

test('normalizes category punctuation and whitespace', () => {
  assert.equal(normalizeBillCategory(' Cable / TV '), 'cable tv');
  assert.equal(normalizeBillCategory('WI-FI'), 'wi fi');
  assert.equal(normalizeBillCategory('  Credit_Card  '), 'credit card');
});
