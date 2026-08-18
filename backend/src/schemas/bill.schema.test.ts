import assert from 'node:assert/strict';
import test from 'node:test';
import { billPaymentSchema, createBillSchema } from './bill.schema.js';

const categories = [
  'Electricity',
  'Water',
  'Internet',
  'Rent',
  'Mobile / Phone',
  'Mortgage',
  'Gas',
  'Cable / TV',
  'Credit Card',
  'Loan',
  'Insurance',
  'Taxes',
  'HOA / Association',
  'Tuition / School',
  'Maintenance',
  'Other',
];

test('bill categories exposed by mobile are accepted as canonical category strings', () => {
  for (const category of categories) {
    assert.equal(
      createBillSchema.safeParse({
        title: 'BDO',
        amount: 1000,
        category,
        due_date: '2026-08-20',
        recurring: false,
        frequency: null,
      }).success,
      true,
      category,
    );
  }
});

test('one-time bills accept an empty frequency and normalize it to null', () => {
  const result = createBillSchema.safeParse({
    title: 'Internet',
    amount: 1600,
    category: 'Bills',
    due_date: '2026-08-20',
    recurring: false,
    frequency: '',
  });

  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.frequency, null);
});

test('recurring bills require a frequency with a user-facing message', () => {
  const result = createBillSchema.safeParse({
    title: 'Internet',
    amount: 1600,
    category: 'Bills',
    due_date: '2026-08-20',
    recurring: true,
    frequency: null,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0]?.message, 'Select how often this bill repeats.');
  }
});

test('bill schema remains strict and does not accept custom_category', () => {
  const result = createBillSchema.safeParse({
    title: 'BDO',
    amount: 1000,
    category: 'Credit Card',
    due_date: '2026-08-20',
    recurring: false,
    frequency: null,
    custom_category: 'Credit Card',
  });
  assert.equal(result.success, false);
});

test('bill payment identifies the occurrence being confirmed', () => {
  const payment = {
    wallet_id: '57d26237-af65-4e71-9f43-97aa9fbc7919',
    payment_date: '2026-08-18',
    occurrence_date: '2026-08-14',
  };

  assert.equal(billPaymentSchema.safeParse(payment).success, true);
  assert.equal(
    billPaymentSchema.safeParse({
      wallet_id: payment.wallet_id,
      payment_date: payment.payment_date,
    }).success,
    false,
  );
});
