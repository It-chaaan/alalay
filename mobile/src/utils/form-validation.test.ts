import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBillForm, validateMoney } from './form-validation';

const valid = { name: 'Meralco', amount: '500', date: '2026-09-08', category: 'Electricity', walletId: 'wallet' };
test('bill validation identifies only the invalid field', () => {
  assert.deepEqual(validateBillForm({ ...valid, amount: '' }), { amount: 'Enter a bill amount.' });
  assert.deepEqual(validateBillForm({ ...valid, name: '' }), { name: 'Enter a biller name.' });
  assert.deepEqual(validateBillForm({ ...valid, name: '', amount: '' }), { name: 'Enter a biller name.', amount: 'Enter a bill amount.' });
});
test('money validation distinguishes empty, malformed, zero, negative, and decimal values', () => {
  assert.equal(validateMoney('', 'bill amount'), 'Enter a bill amount.');
  assert.equal(validateMoney('abc', 'bill amount'), 'Enter a valid bill amount.');
  assert.equal(validateMoney('0', 'bill amount'), 'Bill amount must be greater than zero.');
  assert.equal(validateMoney('-1', 'bill amount'), 'Bill amount cannot be negative.');
  assert.equal(validateMoney('1,250.50', 'bill amount'), undefined);
});
test('whitespace names and missing related fields are field-specific', () => {
  const errors = validateBillForm({ ...valid, name: '   ', category: 'Other', customCategory: '', walletId: null });
  assert.equal(errors.name, 'Enter a valid biller name.');
  assert.equal(errors.customCategory, 'Specify a bill category.');
  assert.equal(errors.wallet, 'Select a wallet.');
});
