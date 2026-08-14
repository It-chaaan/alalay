import assert from 'node:assert/strict';
import { filterSubscriptions, normalizeSubscriptionSearch } from './subscription-search';

const subscriptions = [
  { id: 'chatgpt', name: 'ChatGPT', category: 'AI', wallet_id: 'bdo' },
  { id: 'spotify', name: 'Spotify', category: 'Entertainment', wallet_id: 'gcash' },
  { id: 'netflix', name: 'Netflix', category: 'Entertainment', wallet_id: 'gcash' },
];
const wallets = [{ id: 'bdo', name: 'BDO' }, { id: 'gcash', name: 'GCash' }];

assert.equal(normalizeSubscriptionSearch('  SpOtIfY  '), 'spotify');
assert.deepEqual(filterSubscriptions(subscriptions, wallets, 'chat').map((row) => row.id), ['chatgpt']);
assert.deepEqual(filterSubscriptions(subscriptions, wallets, 'CHAT').map((row) => row.id), ['chatgpt']);
assert.deepEqual(filterSubscriptions(subscriptions, wallets, 'spot').map((row) => row.id), ['spotify']);
assert.deepEqual(filterSubscriptions(subscriptions, wallets, '  netflix  ').map((row) => row.id), ['netflix']);
assert.deepEqual(filterSubscriptions(subscriptions, wallets, 'gcash').map((row) => row.id), ['spotify', 'netflix']);
assert.deepEqual(filterSubscriptions(subscriptions, wallets, '').map((row) => row.id), ['chatgpt', 'spotify', 'netflix']);
assert.deepEqual(filterSubscriptions(subscriptions, wallets, 'missing'), []);

console.log('subscription search tests passed');
