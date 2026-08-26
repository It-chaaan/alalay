import assert from 'node:assert/strict';
import { institutionFor, supportsAccountType } from './institution-registry';

assert.equal(institutionFor('cash').supportedAccountTypes.length, 0);
assert.equal(supportsAccountType('gcash', 'debit'), false);
assert.equal(supportsAccountType('bdo', 'debit'), true);
assert.equal(supportsAccountType('bdo', 'credit'), true);
console.log('institution capability tests passed');
