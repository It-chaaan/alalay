import assert from 'node:assert/strict';
import { walletTransferSchema } from './wallet.schema.js';

const base = { from_wallet_id: '11111111-1111-4111-8111-111111111111', to_wallet_id: '22222222-2222-4222-8222-222222222222', amount: 1000.5, date: '2026-08-14', idempotency_key: 'transfer-request-key-1234' };

assert.equal(walletTransferSchema.parse(base).fee, 0);
assert.equal(walletTransferSchema.parse({ ...base, fee: 10.25, transfer_method: 'instapay' }).fee, 10.25);
assert.throws(() => walletTransferSchema.parse({ ...base, fee: -0.01 }));
assert.throws(() => walletTransferSchema.parse({ ...base, from_wallet_id: base.to_wallet_id }));

console.log('wallet transfer schema tests passed');
