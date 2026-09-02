import assert from 'node:assert/strict';

import {
  nextWalletBalanceVisibility,
  walletBalanceVisibilityFromStoredValue,
} from './wallet-balance-privacy';

// Home and Wallet both consume this one persisted preference: a change in either
// direction is therefore retained across navigation and restart.
assert.equal(walletBalanceVisibilityFromStoredValue('hidden'), false);
assert.equal(walletBalanceVisibilityFromStoredValue('visible'), true);
assert.equal(walletBalanceVisibilityFromStoredValue(null), true);
assert.equal(nextWalletBalanceVisibility(false), true);
assert.equal(nextWalletBalanceVisibility(true), false);
assert.equal(nextWalletBalanceVisibility(null), false);

console.log('wallet balance privacy tests passed');
