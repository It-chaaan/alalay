import assert from 'node:assert/strict';
import test from 'node:test';
import {
  selectCurrentSubscriptionOccurrence,
  subtractSubscriptionCycle,
} from './subscription-occurrence.service.js';

const monthlySubscription = {
  id: 'chatgpt',
  user_id: 'user-1',
  renewal_date: '2026-09-02',
  billing_cycle: 'monthly' as const,
  created_at: '2026-01-01T00:00:00.000Z',
};

test('a paid subscription remains in the current monthly cycle until month activation', () => {
  const august = selectCurrentSubscriptionOccurrence(
    monthlySubscription,
    new Set(['2026-08-02']),
    '2026-08-31',
  );
  assert.deepEqual(august, {
    current_occurrence_date: '2026-08-02',
    current_status: 'paid',
    next_renewal_date: '2026-09-02',
  });

  const september = selectCurrentSubscriptionOccurrence(
    monthlySubscription,
    new Set(['2026-08-02']),
    '2026-09-01',
  );
  assert.equal(september.current_occurrence_date, '2026-09-02');
  assert.equal(september.current_status, 'upcoming');
});

test('an unresolved prior subscription occurrence remains overdue', () => {
  const occurrence = selectCurrentSubscriptionOccurrence(
    monthlySubscription,
    new Set(),
    '2026-08-18',
  );
  assert.equal(occurrence.current_occurrence_date, '2026-08-02');
  assert.equal(occurrence.current_status, 'overdue');
});

test('cycle subtraction respects leap-month anchors', () => {
  assert.equal(subtractSubscriptionCycle('2026-03-31', 'monthly'), '2026-02-28');
  assert.equal(subtractSubscriptionCycle('2026-09-14', 'quarterly'), '2026-06-14');
});
