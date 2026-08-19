import assert from 'node:assert/strict';
import test from 'node:test';
import { createBillSchema } from '../schemas/bill.schema.js';
import { createExpenseSchema } from '../schemas/expense.schema.js';
import { createIncomeSchema } from '../schemas/income.schema.js';
import { createLoanSchema, loanPaymentSchema } from '../schemas/loan.schema.js';
import { createSubscriptionSchema } from '../schemas/subscription.schema.js';
import { creditRepaymentSchema, walletTransferSchema } from '../schemas/wallet.schema.js';

const walletId = '11111111-1111-4111-8111-111111111111';
const otherWalletId = '22222222-2222-4222-8222-222222222222';
const date = '2026-08-18';

test('web and mobile income payloads share the one-time contract', () => {
  const webPayload = {
    source: 'Company',
    type: 'allowance',
    amount: 1500,
    date,
    is_recurring: false,
    frequency: null,
    wallet_id: walletId,
  };
  const mobilePayload = {
    source: 'Company',
    type: 'allowance',
    amount: 1500,
    date,
    is_recurring: false,
    frequency: null,
    wallet_id: walletId,
  };

  assert.deepEqual(createIncomeSchema.parse(webPayload), createIncomeSchema.parse(mobilePayload));
});

test('recurring income requires an explicit canonical frequency', () => {
  assert.equal(
    createIncomeSchema.safeParse({
      source: 'Payroll',
      type: 'salary',
      amount: 30000,
      date,
      is_recurring: true,
      frequency: 'monthly',
      wallet_id: walletId,
    }).success,
    true,
  );
  assert.equal(
    createIncomeSchema.safeParse({
      source: 'Payroll',
      type: 'salary',
      amount: 30000,
      date,
      is_recurring: true,
      wallet_id: walletId,
    }).success,
    false,
  );
});

test('financial creation contracts require canonical wallet IDs', () => {
  const expense = {
    merchant: 'Mercury Drug',
    amount: 500,
    category: 'Healthcare',
    date,
    wallet_id: walletId,
  };
  const subscription = {
    name: 'Viu',
    amount: 45,
    category: 'Movies / Streaming',
    renewal_date: date,
    billing_cycle: 'monthly',
    wallet_id: walletId,
  };

  assert.equal(createExpenseSchema.safeParse(expense).success, true);
  assert.equal(createSubscriptionSchema.safeParse(subscription).success, true);
  assert.equal(createExpenseSchema.safeParse({ ...expense, wallet_id: 'GCash' }).success, false);
  assert.equal(
    createSubscriptionSchema.safeParse({ ...subscription, wallet_id: undefined }).success,
    false,
  );
});

test('bill, transfer, and loan contracts reject invalid financial state before mutation', () => {
  assert.equal(
    createBillSchema.safeParse({
      title: 'Internet',
      amount: 2000,
      category: 'Internet',
      due_date: date,
      recurring: false,
      frequency: null,
      wallet_id: walletId,
    }).success,
    true,
  );
  assert.equal(
    createBillSchema.safeParse({
      title: 'Credit statement',
      amount: 2000,
      category: 'Credit Card',
      due_date: date,
      recurring: false,
      frequency: null,
      credit_wallet_id: otherWalletId,
    }).success,
    true,
  );
  assert.equal(
    walletTransferSchema.safeParse({
      from_wallet_id: walletId,
      to_wallet_id: walletId,
      amount: 1000,
      date,
      idempotency_key: 'transfer-contract-test-0001',
    }).success,
    false,
  );
  assert.equal(
    createLoanSchema.safeParse({
      wallet_id: walletId,
      direction: 'lent',
      counterparty: 'John',
      principal: 5000,
      interest_type: 'none',
      idempotency_key: 'loan-contract-test-00000001',
    }).success,
    true,
  );
  assert.equal(
    loanPaymentSchema.safeParse({
      wallet_id: otherWalletId,
      principal_amount: 0,
      interest_amount: 0,
      idempotency_key: 'loan-payment-contract-test-01',
    }).success,
    false,
  );
});

test('credit repayment contract keeps principal, interest, fee, and idempotency explicit', () => {
  const payload = creditRepaymentSchema.parse({
    payment_wallet_id: otherWalletId,
    principal_amount: 2000,
    interest_amount: 100,
    fee_amount: 25,
    payment_date: date,
    idempotency_key: 'credit-repayment-contract-0001',
  });

  assert.deepEqual(payload, {
    payment_wallet_id: otherWalletId,
    principal_amount: 2000,
    interest_amount: 100,
    fee_amount: 25,
    payment_date: date,
    idempotency_key: 'credit-repayment-contract-0001',
  });
  assert.equal(
    creditRepaymentSchema.safeParse({ ...payload, principal_amount: 0 }).success,
    false,
  );
  assert.equal(
    creditRepaymentSchema.safeParse({ ...payload, interest_amount: -1 }).success,
    false,
  );
  assert.equal(
    creditRepaymentSchema.safeParse({ ...payload, fee_amount: -1 }).success,
    false,
  );
});
