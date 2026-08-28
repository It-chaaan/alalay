import assert from 'node:assert/strict';
import test from 'node:test';
import { cycleIndex, visibleWallets, walletSlotOffset } from './wallet-stack';

const wallets = ['A', 'B', 'C', 'D', 'E', 'F'];

test('renders at most three real wallets without truncating the source', () => {
  assert.deepEqual(visibleWallets([], 0), []);
  assert.deepEqual(visibleWallets(['A'], 0), ['A']);
  assert.deepEqual(visibleWallets(['A', 'B'], 0), ['A', 'B']);
  assert.deepEqual(visibleWallets(wallets, 0), ['A', 'B', 'C']);
  assert.equal(wallets.length, 6);
});

test('cycles forward, backward, and wraps deterministically', () => {
  assert.deepEqual(visibleWallets(wallets, cycleIndex(0, wallets.length, 1)), ['B', 'C', 'D']);
  assert.deepEqual(visibleWallets(wallets, cycleIndex(0, wallets.length, 2)), ['C', 'D', 'E']);
  assert.equal(cycleIndex(5, wallets.length, 1), 0);
  assert.equal(cycleIndex(0, wallets.length, -1), 5);
});

test('keeps the highest rear exposure at half of the previous 40px offset', () => {
  assert.equal(walletSlotOffset(0), 0);
  assert.equal(walletSlotOffset(1), -10);
  assert.equal(walletSlotOffset(2), -20);
  assert.equal(Math.abs(walletSlotOffset(2)), 40 * 0.5);
});
