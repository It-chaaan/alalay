import assert from 'node:assert/strict';
import { institutionFor, institutionRegistry, sanitizeWalletMetadata, supportsAccountType } from './institution-registry';

assert.equal(institutionFor('cash').supportedAccountTypes.length, 0);
assert.equal(supportsAccountType('gcash', 'debit'), false);
assert.equal(institutionFor('gotyme').institutionType, 'digital_bank');
assert.equal(institutionFor('gotyme').supportedAccountTypes.length, 2);
assert.equal(institutionFor('maribank').brandColor, '#FF6B00');
assert.match(institutionFor('maribank').brandColor, /^#FF/);
assert.equal(new Set(institutionRegistry.map((item) => item.id)).size, institutionRegistry.length);
assert.equal(new Set(institutionRegistry.map((item) => item.displayName)).size, institutionRegistry.length);
for (const key of ['gcash', 'maya', 'gotyme', 'maribank', 'bdo', 'bpi', 'cash'] as const) assert.ok(institutionRegistry.some((item) => item.id === key));
assert.equal(institutionFor('maya').institutionType, 'e_wallet');
assert.equal(institutionFor('maya_bank').institutionType, 'digital_bank');
assert.deepEqual(institutionFor('maya').supportedAccountTypes, []);
assert.ok(institutionFor('maribank').aliases.includes('seabank'));
assert.ok(institutionFor('maya').aliases.includes('paymaya'));
assert.ok(institutionFor('aub').aliases.includes('asia united bank'));
assert.ok(institutionFor('ofbank').aliases.includes('overseas filipino bank'));
assert.equal(supportsAccountType('bdo', 'debit'), true);
assert.equal(supportsAccountType('bdo', 'credit'), true);
assert.deepEqual(sanitizeWalletMetadata('gcash', {
  accountType: 'credit', accountPurpose: 'savings', earnsInterest: true, annualInterestRate: 3,
}), {
  account_type: null, account_purpose: null, earns_interest: false,
  annual_interest_rate: null, interest_credit_frequency: null,
});
assert.deepEqual(sanitizeWalletMetadata('maribank', {
  accountType: 'debit', accountPurpose: 'savings', earnsInterest: true,
  annualInterestRate: 3.5, interestCreditFrequency: 'monthly',
}), {
  account_type: 'debit', account_purpose: 'savings', earns_interest: true,
  annual_interest_rate: 3.5, interest_credit_frequency: 'monthly',
});
console.log('institution capability tests passed');
