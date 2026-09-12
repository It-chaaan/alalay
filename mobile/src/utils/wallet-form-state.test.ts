import assert from 'node:assert/strict';

import { defaultTransferFeeForSource } from './wallet-form-state';

const wallets = [
  { id: 'cash', default_outgoing_transfer_fee: null },
  { id: 'bank', default_outgoing_transfer_fee: 15 },
];

assert.equal(defaultTransferFeeForSource(wallets, 'cash'), '0');
assert.equal(defaultTransferFeeForSource(wallets, 'bank'), '15');
assert.equal(defaultTransferFeeForSource(wallets, 'missing'), '0');

let manuallyEditedFee = '7.50';
assert.equal(manuallyEditedFee, '7.50');
manuallyEditedFee = defaultTransferFeeForSource(wallets, 'bank');
assert.equal(manuallyEditedFee, '15');

console.log('wallet form state tests passed');
