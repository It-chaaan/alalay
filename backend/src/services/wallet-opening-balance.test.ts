import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWalletOpeningBalanceRpcArgs } from './wallet-opening-balance.js';

test('opening-balance RPC payload names the complete canonical function signature', () => {
  const args = buildWalletOpeningBalanceRpcArgs({
    name: 'Cash',
    institution_type: 'cash',
    institution_key: 'cash',
    opening_balance: 1250.5,
    payment_due_date: null,
    payment_wallet_id: null,
    auto_record_payment: false,
    payment_rule: null,
    fixed_payment_amount: null,
  });
  assert.equal(args.opening_amount, 1250.5);
  assert.equal(args.wallet_currency, 'PHP');
  assert.equal(args.payment_due_date_value, null);
  assert.equal(Object.keys(args).length, 19);
});
