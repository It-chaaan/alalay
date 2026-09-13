import assert from 'node:assert/strict';
import { subscriptionReminderForOccurrence, subscriptionReminderKind, subscriptionReminderReference } from './subscription-reminders.service.js';

const prefs = {
  subscription_reminders: true,
  subscription_reminder_three_days: true,
  subscription_reminder_one_day: true,
  subscription_reminder_due_day: true,
  subscription_overdue_reminders: true,
};

assert.equal(subscriptionReminderKind('2026-09-12', prefs, '2026-09-09'), 'three_days_before');
assert.equal(subscriptionReminderKind('2026-09-12', prefs, '2026-09-11'), 'one_day_before');
assert.equal(subscriptionReminderKind('2026-09-12', prefs, '2026-09-12'), 'due_day');
// This is the Spotify regression: the immutable expense occurrence still
// qualifies after billing advances the mutable subscription renewal date.
assert.equal(subscriptionReminderKind('2026-09-12', prefs, '2026-09-13'), 'overdue');
assert.equal(subscriptionReminderKind('2026-09-12', prefs, '2026-09-18'), 'overdue', 'immutable occurrences recover delayed scheduler runs for seven days');
assert.equal(subscriptionReminderKind('2026-09-12', { ...prefs, subscription_reminders: false }, '2026-09-09'), null);
assert.equal(subscriptionReminderKind('2026-09-12', prefs, '2026-09-20'), null);
assert.equal(subscriptionReminderForOccurrence({ occurrence_date: '2026-09-12', status: 'processed' }, prefs, '2026-09-13'), 'renewal_processed', 'late billed Spotify occurrences are accurate historical notifications, not stale overdue notices');
assert.deepEqual(subscriptionReminderReference('spotify', '2026-09-12', 'monthly', 'overdue'), {
  related_subscription_id: 'spotify',
  source_type: 'subscription_occurrence',
  source_id: 'spotify:2026-09-12:monthly',
  deduplication_key: 'subscription-occurrence:spotify:2026-09-12:monthly:overdue',
  action: { route: '/(tabs)/subscriptions', params: { subscriptionId: 'spotify', occurrenceDate: '2026-09-12' } },
});

console.log('subscription occurrence reminder tests passed');
