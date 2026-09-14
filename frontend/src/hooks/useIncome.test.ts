import assert from 'node:assert/strict';
import { incomeMonthEntries, type IncomeMonthItem } from '../utils/incomeMonth.js';

const recurringProjected: IncomeMonthItem = {
  kind: 'recurring', sourceId: 'schedule-1', occurrenceId: null, isProjected: true,
  occurrenceKey: 'schedule-1:2026-09-15', transactionId: null, name: 'Salary',
  category: 'salary', amount: 50000, frequency: 'monthly', status: 'upcoming',
  dueDate: '2026-09-15', receivedDate: null, receivedAt: null, createdAt: null,
  updatedAt: null, walletId: 'wallet-1',
};
const oneTimeReceived: IncomeMonthItem = {
  ...recurringProjected, kind: 'one_time', sourceId: 'income-1', occurrenceId: null,
  isProjected: false, occurrenceKey: 'income-1:2026-09-03', transactionId: 'income-1',
  name: 'Freelance', category: 'freelance', amount: 1250, frequency: null,
  status: 'received', dueDate: null, receivedDate: '2026-09-03',
};

const rows = incomeMonthEntries([recurringProjected, oneTimeReceived]);
assert.equal(rows.length, 2, 'web preserves every month-contract item from mobile/backend');
assert.deepEqual(rows.map((row) => [row.id, row.date, row.status, row.is_projected]), [
  ['projection:schedule-1:2026-09-15', '2026-09-15', 'upcoming', true],
  ['income-1', '2026-09-03', 'received', false],
]);
assert.equal(rows[0].frequency, 'monthly');
assert.equal(rows[1].frequency, undefined);
console.log('income month contract mapping tests passed');
