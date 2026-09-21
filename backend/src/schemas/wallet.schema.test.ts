import assert from 'node:assert/strict';
import {
  createWalletWithOpeningBalanceSchema,
  walletInterestSchema,
  walletTransferSchema,
} from './wallet.schema.js';

const base = {
  from_wallet_id: '11111111-1111-4111-8111-111111111111',
  to_wallet_id: '22222222-2222-4222-8222-222222222222',
  amount: 1000.5,
  date: '2026-08-14',
  idempotency_key: 'transfer-request-key-1234',
};

assert.equal(walletTransferSchema.parse(base).fee, 0);
assert.equal(
  walletTransferSchema.parse({ ...base, fee: 10.25, transfer_method: 'instapay' }).fee,
  10.25,
);
assert.throws(() => walletTransferSchema.parse({ ...base, fee: -0.01 }));
assert.throws(() => walletTransferSchema.parse({ ...base, from_wallet_id: base.to_wallet_id }));

console.log('wallet transfer schema tests passed');

const wallet = {
  name: 'MariBank',
  institution_type: 'digital_bank' as const,
  institution_key: 'maribank',
  account_type: 'debit' as const,
  opening_balance: 0,
};
assert.equal(createWalletWithOpeningBalanceSchema.parse(wallet).account_type, 'debit');
assert.equal(
  createWalletWithOpeningBalanceSchema.parse({ ...wallet, account_purpose: 'savings' })
    .account_purpose,
  'savings',
);
assert.throws(() =>
  createWalletWithOpeningBalanceSchema.parse({
    ...wallet,
    account_purpose: 'savings',
    earns_interest: true,
    annual_interest_rate: -1,
  }),
);
assert.throws(() =>
  createWalletWithOpeningBalanceSchema.parse({
    ...wallet,
    account_type: 'credit',
    account_purpose: 'savings',
  }),
);
assert.throws(() =>
  createWalletWithOpeningBalanceSchema.parse({
    ...wallet,
    account_purpose: 'everyday',
    annual_interest_rate: 3.5,
  }),
);
console.log('wallet metadata schema tests passed');

const interest = {
  amount: 12.34,
  date: '2026-09-21',
  idempotency_key: 'interest-request-key-1234',
};
assert.equal(walletInterestSchema.parse(interest).idempotency_key, interest.idempotency_key);
assert.throws(() => walletInterestSchema.parse({ ...interest, idempotency_key: '' }));
assert.throws(() => walletInterestSchema.parse({ ...interest, idempotency_key: 'short' }));
assert.throws(() => walletInterestSchema.parse({ amount: interest.amount, date: interest.date }));
assert.throws(() => walletInterestSchema.parse({ ...interest, idempotency_key: 'x'.repeat(201) }));
console.log('wallet interest idempotency schema tests passed');
