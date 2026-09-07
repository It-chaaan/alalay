import assert from 'node:assert/strict';

import {
  canApplyIncomeResponse,
  canStartIncomeSave,
  incomeDeleteRequestIntent,
  incomeRequestIntent,
  manilaIncomeMonth,
  moveIncomeMonth,
  occurrenceBelongsToIncomeMonth,
  shouldRefreshIncomeForMutation,
  presentationIncomeOccurrences,
} from './income-screen';

assert.equal(moveIncomeMonth('2026-07', 1), '2026-08');
assert.equal(moveIncomeMonth('2026-12', 1), '2027-01');
assert.equal(moveIncomeMonth('2028-03', -1), '2028-02');
assert.equal(moveIncomeMonth('2028-02', 1), '2028-03');
assert.equal(manilaIncomeMonth(new Date('2026-07-31T15:59:59.000Z')), '2026-07');
assert.equal(manilaIncomeMonth(new Date('2026-07-31T16:00:00.000Z')), '2026-08');

assert.equal(canApplyIncomeResponse({ requestId: 4, currentRequestId: 4, focused: true }), true);
assert.equal(canApplyIncomeResponse({ requestId: 4, currentRequestId: 5, focused: true }), false);
assert.equal(canApplyIncomeResponse({ requestId: 4, currentRequestId: 4, focused: false }), false);

assert.deepEqual(incomeRequestIntent(), { path: '/api/income', method: 'POST' });
assert.deepEqual(incomeRequestIntent('income-42'), {
  path: '/api/income/income-42',
  method: 'PATCH',
});
assert.deepEqual(incomeDeleteRequestIntent('income-42'), {
  path: '/api/income/income-42',
  method: 'DELETE',
});
assert.equal(canStartIncomeSave(false), true);
assert.equal(canStartIncomeSave(true), false);
assert.equal(
  occurrenceBelongsToIncomeMonth(
    { sourceId: 'salary', occurrenceKey: 'salary:2026-08-01', dueDate: '2026-08-01' },
    '2026-08',
  ),
  true,
);
assert.equal(
  occurrenceBelongsToIncomeMonth(
    { sourceId: 'salary', occurrenceKey: 'salary:2026-07-31', dueDate: '2026-07-31' },
    '2026-08',
  ),
  false,
);
assert.equal(shouldRefreshIncomeForMutation(true), true);
assert.equal(shouldRefreshIncomeForMutation(false), false);

const presentation = presentationIncomeOccurrences([
  { kind: 'recurring', isProjected: true, occurrenceKey: 'salary:2026-08-01', sourceId: 'salary' },
  { kind: 'recurring', isProjected: true, occurrenceKey: 'salary:2026-08-01', sourceId: 'salary' },
  { kind: 'recurring', isProjected: true, occurrenceKey: 'salary:2026-08-15', sourceId: 'salary' },
  { kind: 'one_time', isProjected: false, occurrenceKey: 'manual:2026-08-01', transactionId: 'transaction-1', sourceId: 'one-time' },
  { kind: 'one_time', isProjected: false, occurrenceKey: 'manual:2026-08-01', transactionId: 'transaction-2', sourceId: 'one-time' },
]);
assert.equal(presentation.duplicateProjectedOccurrences, 1);
assert.deepEqual(presentation.items.map((item) => item.transactionId ?? item.occurrenceKey), [
  'salary:2026-08-01',
  'salary:2026-08-15',
  'transaction-1',
  'transaction-2',
]);

console.log('income screen tests passed');
