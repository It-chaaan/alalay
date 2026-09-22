import assert from 'node:assert/strict';
import test from 'node:test';
import {
  materializeBillOccurrence,
  occurrenceDateFromAnchor,
  occurrenceStatus,
  splitOccurrencesForMonth,
} from './bill-occurrence.service.js';

test('August paid occurrence stays historical and September is independently unpaid', () => {
  const rows = [
    { occurrence_date: '2026-08-30', status: 'paid' as const, paid_at: '2026-08-30T02:00:00Z' },
    { occurrence_date: '2026-09-30', status: 'unpaid' as const, paid_at: null },
  ];
  const september = splitOccurrencesForMonth(rows, '2026-09', '2026-09-02');
  assert.deepEqual(
    september.items.map((row) => row.occurrence_date),
    ['2026-09-30'],
  );
  assert.equal(occurrenceStatus(september.items[0], '2026-09-02'), 'upcoming');
  assert.equal(occurrenceStatus(rows[0], '2026-09-02'), 'paid');
});

test('only genuinely unpaid prior periods appear as overdue', () => {
  const rows = [
    { occurrence_date: '2026-08-30', status: 'paid' as const, paid_at: '2026-08-30T02:00:00Z' },
    { occurrence_date: '2026-08-31', status: 'unpaid' as const, paid_at: null },
  ];
  assert.deepEqual(
    splitOccurrencesForMonth(rows, '2026-09', '2026-09-02').overdue_items.map(
      (row) => row.occurrence_date,
    ),
    ['2026-08-31'],
  );
});

test('month-end recurrence preserves the original anchor day', () => {
  assert.equal(occurrenceDateFromAnchor('2026-01-31', 'monthly', 1), '2026-02-28');
  assert.equal(occurrenceDateFromAnchor('2026-01-31', 'monthly', 2), '2026-03-31');
});

test('a legacy template cannot overwrite the occurrence month or payment state', () => {
  const item = materializeBillOccurrence(
    {
      id: 'september-occurrence',
      bill_id: 'template',
      user_id: 'user',
      occurrence_date: '2026-09-30',
      occurrence_period: '2026-09',
      status: 'unpaid',
      paid_at: null,
      bill: { due_date: '2026-08-30', status: 'paid', title: 'Apartment', recurring: true },
    },
    '2026-09-02',
  );
  assert.equal(item.due_date, '2026-09-30');
  assert.equal(item.status, 'upcoming');
});
