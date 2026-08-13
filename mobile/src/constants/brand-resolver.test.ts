import assert from 'node:assert/strict';
import test from 'node:test';

import { initialForName, normalizeBrandName, resolveBrand } from './brand-resolver';

test('normalizes common brand punctuation and spacing', () => {
  assert.equal(normalizeBrandName('  Go-Tyme  '), 'go tyme');
  assert.equal(normalizeBrandName('Manila Water (Maynilad)'), 'manila water maynilad');
});

test('resolves subscription and bill brands from conservative aliases', () => {
  assert.equal(resolveBrand('Netflix Premium', 'subscription')?.key, 'netflix');
  assert.equal(resolveBrand('Spotify Premium', 'subscription')?.key, 'spotify');
  assert.equal(resolveBrand('Meralco Electricity', 'bill')?.key, 'meralco');
  assert.equal(resolveBrand('PLDT Fiber', 'bill')?.key, 'pldt');
});

test('prefers structured wallet institution keys', () => {
  assert.equal(resolveBrand('Emergency Fund', 'wallet', 'bdo')?.key, 'bdo');
  assert.equal(resolveBrand('My Main Wallet', 'wallet', 'security_bank')?.key, 'security_bank');
});

test('keeps Cash and GCash distinct', () => {
  assert.equal(resolveBrand('Cash', 'wallet')?.key, 'cash');
  assert.equal(resolveBrand('GCash E-Wallet', 'wallet')?.key, 'gcash');
  assert.equal(resolveBrand('Cash', 'subscription'), null);
});

test('returns no brand for unknown names and still provides initials', () => {
  assert.equal(resolveBrand('Quarterly Pilates Studio', 'subscription'), null);
  assert.equal(initialForName('Quarterly Pilates Studio'), 'QP');
});
