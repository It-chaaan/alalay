import assert from 'node:assert/strict';
import test from 'node:test';
import { selectCurrentBillOccurrence } from './bill-occurrence.service.js';

const recurringBill = {
  recurring: true,
  frequency: 'monthly',
  due_date: '2026-09-14',
  paid_occurrence_date: '2026-08-14',
  paid_at: '2026-08-18T00:00:00.000Z',
  status: 'unpaid',
};

test('a paid monthly occurrence remains active until the next month', () => {
  const august = selectCurrentBillOccurrence(recurringBill, '2026-08-31');
  assert.equal(august.status, 'paid');
  assert.equal(august.due_date, '2026-08-14');

  const september = selectCurrentBillOccurrence(recurringBill, '2026-09-01');
  assert.equal(september.status, 'unpaid');
  assert.equal(september.due_date, '2026-09-14');
});

test('quarterly and yearly periods activate at their calendar boundaries', () => {
  const quarterlyRecord = {
    ...recurringBill,
    frequency: 'quarterly',
    due_date: '2026-10-14',
    paid_occurrence_date: '2026-07-14',
  };
  const quarterly = selectCurrentBillOccurrence(
    quarterlyRecord,
    '2026-09-30',
  );
  assert.equal(quarterly.status, 'paid');
  assert.equal(selectCurrentBillOccurrence(quarterlyRecord, '2026-10-01').status, 'unpaid');

  const yearlyRecord = {
    ...recurringBill,
    frequency: 'yearly',
    due_date: '2027-08-14',
    paid_occurrence_date: '2026-08-14',
  };
  const yearly = selectCurrentBillOccurrence(
    yearlyRecord,
    '2026-08-31',
  );
  assert.equal(yearly.status, 'paid');
  assert.equal(selectCurrentBillOccurrence(yearlyRecord, '2027-01-01').status, 'unpaid');
});

test('an unpaid prior occurrence is not replaced by the next schedule', () => {
  const overdue = selectCurrentBillOccurrence({
    recurring: true,
    frequency: 'monthly',
    due_date: '2026-08-14',
    paid_occurrence_date: null,
    paid_at: null,
    status: 'unpaid',
  }, '2026-09-01');

  assert.equal(overdue.due_date, '2026-08-14');
  assert.equal(overdue.status, 'unpaid');
});

test('weekly periods activate on the next scheduled week', () => {
  const record = {
    ...recurringBill,
    frequency: 'weekly',
    due_date: '2026-09-07',
    paid_occurrence_date: '2026-08-31',
  };

  assert.equal(selectCurrentBillOccurrence(record, '2026-09-06').status, 'paid');
  assert.equal(selectCurrentBillOccurrence(record, '2026-09-07').status, 'unpaid');
});
