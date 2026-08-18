import assert from 'node:assert/strict';
import { walletTransferPerspective } from './wallet-transactions.js';

const transfer = {
  id: 'transfer-1',
  from_wallet_id: 'bdo',
  to_wallet_id: 'gcash',
  amount: 500,
  fee: 15,
  transferred_at: '2026-08-18',
};

const source = walletTransferPerspective(transfer, 'bdo', 'GCash');
assert.equal(source.kind, 'transfer_out');
assert.equal(source.label, 'Transfer to GCash');
assert.equal(source.amount, -500, 'the linked fee expense must not be merged into principal');

const destination = walletTransferPerspective(transfer, 'gcash', 'BDO');
assert.equal(destination.kind, 'transfer_in');
assert.equal(destination.label, 'Transfer from BDO');
assert.equal(destination.amount, 500);

console.log('wallet transaction perspective tests passed');
