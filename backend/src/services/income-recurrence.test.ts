import assert from 'node:assert/strict';
import { expandIncomeRows } from './income-recurrence.service.js';

const rows = expandIncomeRows(
  [
    {
      id: 'salary',
      source: 'Salary',
      amount: 30000,
      date: '2026-07-03',
      is_recurring: true,
      frequency: 'monthly',
      is_posted: false,
      schedule_status: 'active',
    },
    {
      id: 'freelance',
      source: 'Freelance',
      amount: 15000,
      date: '2026-07-12',
      is_recurring: 'true',
      frequency: 'Monthly',
      is_posted: false,
      schedule_status: 'active',
    },
  ],
  '2026-08-01',
  '2026-08-31',
);

assert.deepEqual(
  rows.map((row) => [row.date, row.amount, row.is_scheduled]),
  [
    ['2026-08-12', 15000, true],
    ['2026-08-03', 30000, true],
  ],
);

const septemberRows = expandIncomeRows(
  [
    {
      id: 'august-salary',
      source: 'August salary',
      amount: 30000,
      date: '2026-08-31',
      is_recurring: true,
      frequency: 'monthly',
      is_posted: false,
      schedule_status: 'active',
    },
  ],
  '2026-09-01',
  '2026-09-30',
);
assert.deepEqual(
  septemberRows.map((row) => [row.date, row.is_scheduled]),
  [['2026-09-30', true]],
  'an August-created monthly definition remains visible in September',
);

const recorded = expandIncomeRows(
  [
    {
      id: 'salary',
      source: 'Salary',
      amount: 30000,
      date: '2026-07-03',
      is_recurring: true,
      frequency: 'monthly',
      is_posted: false,
      schedule_status: 'active',
    },
    {
      id: 'salary-august',
      source: 'Salary',
      amount: 30000,
      date: '2026-08-03',
      is_recurring: false,
      is_posted: true,
      schedule_id: 'salary',
    },
  ],
  '2026-08-01',
  '2026-08-31',
);

assert.equal(recorded.length, 1, 'an actual occurrence must suppress its scheduled duplicate');
assert.equal(recorded[0].date, '2026-08-03');
assert.equal(recorded[0].is_scheduled, undefined);

const historicalSchedule = expandIncomeRows(
  [
    {
      id: 'september-schedule',
      schedule_id: 'july-source',
      source: 'Virtual Assistant',
      amount: 15000,
      date: '2026-09-03',
      schedule_anchor_date: '2026-07-03',
      is_recurring: true,
      frequency: 'monthly',
      is_posted: false,
      schedule_status: 'active',
    },
  ],
  '2026-08-01',
  '2026-08-31',
);
assert.deepEqual(
  historicalSchedule.map((row) => row.date),
  ['2026-08-03'],
  'a schedule advanced to September still projects its August occurrence from its immutable anchor',
);

const malformed = expandIncomeRows(
  [
    {
      id: 'legacy',
      source: 'Allowance',
      amount: 5000,
      date: '2026-07-23',
      is_recurring: true,
      frequency: null,
      is_posted: false,
      schedule_status: 'active',
    },
  ],
  '2026-08-01',
  '2026-08-31',
);
assert.equal(malformed.length, 0, 'missing recurrence frequency must not be forecast monthly');

console.log('income recurrence regression tests passed');
