import { asNumber, client, requireUserId, throwIfError, todayIso } from './db.js';
import { addBillingCycle, type SubscriptionBillingCycle } from './subscription-billing.service.js';
import { createInAppNotification, type InAppNotification } from './notifications.service.js';

export type SubscriptionReminderKind =
  'three_days_before' | 'one_day_before' | 'due_day' | 'overdue';

type SubscriptionReminderPreferences = {
  subscription_reminders: boolean;
  subscription_reminder_three_days: boolean;
  subscription_reminder_one_day: boolean;
  subscription_reminder_due_day: boolean;
  subscription_overdue_reminders: boolean;
};

type SubscriptionRow = {
  id: string;
  name: string;
  amount: unknown;
  renewal_date: string;
  billing_cycle: SubscriptionBillingCycle;
  wallet_id?: string | null;
};

type SubscriptionOccurrence = {
  id: string;
  subscription_id: string;
  occurrence_date: string;
  status: 'pending' | 'processed' | 'failed';
  amount: unknown;
  wallet_id: string | null;
  recurrence_key: string;
  subscription: SubscriptionRow | SubscriptionRow[] | null;
};

export type SubscriptionReminderEvent = {
  notification: InAppNotification & {
    reminder_kind: SubscriptionReminderKind | 'renewal_processed';
    due_date: string;
    amount: number;
  };
  subscription_id: string;
  name: string;
  amount: number;
  occurrence_date: string;
  billing_cycle: SubscriptionBillingCycle;
  wallet_id: string | null;
  reminder_kind: SubscriptionReminderKind | 'renewal_processed';
};

const defaults: SubscriptionReminderPreferences = {
  subscription_reminders: true,
  subscription_reminder_three_days: true,
  subscription_reminder_one_day: true,
  subscription_reminder_due_day: true,
  subscription_overdue_reminders: true,
};

function dateAfter(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function validCycle(value: unknown): SubscriptionBillingCycle {
  const cycle = String(value).toLowerCase();
  return cycle === 'weekly' || cycle === 'quarterly' || cycle === 'yearly' ? cycle : 'monthly';
}

/**
 * A reminder is keyed to an immutable subscription occurrence, never the
 * mutable next renewal date. The bounded overdue stage is the recovery window
 * for a delayed scheduler run such as a billing catch-up.
 */
export function subscriptionReminderKind(
  dueDate: string,
  prefs: SubscriptionReminderPreferences,
  today: string,
): SubscriptionReminderKind | null {
  if (!prefs.subscription_reminders) return null;
  if (prefs.subscription_reminder_three_days && dueDate === dateAfter(today, 3))
    return 'three_days_before';
  if (prefs.subscription_reminder_one_day && dueDate === dateAfter(today, 1))
    return 'one_day_before';
  if (prefs.subscription_reminder_due_day && dueDate === today) return 'due_day';
  // Generated subscription expenses preserve this date after renewal_date is
  // advanced. Keep a bounded catch-up window for delayed/out-of-order jobs.
  if (prefs.subscription_overdue_reminders && dueDate < today && dueDate >= dateAfter(today, -7))
    return 'overdue';
  return null;
}

export function subscriptionReminderForOccurrence(
  occurrence: Pick<SubscriptionOccurrence, 'occurrence_date' | 'status'>,
  prefs: SubscriptionReminderPreferences,
  today: string,
) {
  if (!prefs.subscription_reminders) return null;
  if (occurrence.status === 'processed')
    return occurrence.occurrence_date <= today && occurrence.occurrence_date >= dateAfter(today, -7)
      ? ('renewal_processed' as const)
      : null;
  return subscriptionReminderKind(occurrence.occurrence_date, prefs, today);
}

export function subscriptionReminderReference(
  subscriptionId: string,
  occurrenceDate: string,
  cycle: SubscriptionBillingCycle,
  kind: SubscriptionReminderKind | 'renewal_processed',
) {
  const occurrenceKey = `${subscriptionId}:${occurrenceDate}:${cycle}`;
  return {
    related_subscription_id: subscriptionId,
    source_type: 'subscription_occurrence',
    source_id: occurrenceKey,
    deduplication_key: `subscription-occurrence:${occurrenceKey}:${kind}`,
    action: { route: '/(tabs)/subscriptions', params: { subscriptionId, occurrenceDate } },
  };
}

function copy(name: string, kind: SubscriptionReminderKind | 'renewal_processed') {
  if (kind === 'three_days_before') return `${name} renews in 3 days`;
  if (kind === 'one_day_before') return `${name} renews tomorrow`;
  if (kind === 'due_day') return `${name} renews today`;
  if (kind === 'renewal_processed') return `${name} renewal processed`;
  return `${name} renewal is overdue`;
}

/** Reconciles immutable occurrences before reading the reminder horizon. */
export async function syncSubscriptionReminders(userId: string, now = new Date()) {
  const ownerId = requireUserId(userId);
  const today = todayIso(now);
  const prefsResult = await client()
    .from('notification_preferences')
    .select(
      'subscription_reminders, subscription_reminder_three_days, subscription_reminder_one_day, subscription_reminder_due_day, subscription_overdue_reminders',
    )
    .eq('user_id', ownerId)
    .maybeSingle();
  throwIfError(prefsResult.error);
  const prefs = { ...defaults, ...(prefsResult.data ?? {}) } as SubscriptionReminderPreferences;
  const from = dateAfter(today, -7);
  const through = dateAfter(today, 3);
  const reconcileResult = await client().rpc('reconcile_subscription_occurrences', {
    target_user_id: ownerId,
    target_from: from,
    target_through: through,
  });
  throwIfError(reconcileResult.error);
  const occurrencesResult = await client()
    .from('subscription_occurrences')
    .select(
      'id, subscription_id, occurrence_date, status, amount, wallet_id, recurrence_key, subscription:subscriptions!inner(id, name, amount, renewal_date, billing_cycle, wallet_id)',
    )
    .eq('user_id', ownerId)
    .gte('occurrence_date', from)
    .lte('occurrence_date', through);
  throwIfError(occurrencesResult.error);
  const occurrenceSourceIds = (occurrencesResult.data ?? [])
    .map((row) => {
      const nested = Array.isArray(row.subscription) ? row.subscription[0] : row.subscription;
      return nested
        ? `${row.subscription_id}:${String(row.occurrence_date).slice(0, 10)}:${validCycle(nested.billing_cycle)}`
        : null;
    })
    .filter((value): value is string => Boolean(value));
  const existingResult = occurrenceSourceIds.length
    ? await client()
        .from('notifications')
        .select('source_id')
        .eq('user_id', ownerId)
        .eq('source_type', 'subscription_occurrence')
        .in('source_id', occurrenceSourceIds)
    : { data: [], error: null };
  throwIfError(existingResult.error);
  const alreadyNotified = new Set(
    (existingResult.data ?? [])
      .map((row) => row.source_id)
      .filter((value): value is string => typeof value === 'string'),
  );

  const notifications: SubscriptionReminderEvent['notification'][] = [];
  const events: SubscriptionReminderEvent[] = [];
  let eligible = 0;
  let failed = 0;
  for (const occurrence of (occurrencesResult.data ?? []) as SubscriptionOccurrence[]) {
    const subscription = Array.isArray(occurrence.subscription)
      ? occurrence.subscription[0]
      : occurrence.subscription;
    if (!subscription) continue;
    const kind = subscriptionReminderForOccurrence(occurrence, prefs, today);
    if (!kind) continue;
    const sourceId = `${subscription.id}:${occurrence.occurrence_date}:${validCycle(subscription.billing_cycle)}`;
    // A processed receipt is recovery copy only. Do not add it after an
    // earlier pre-due reminder already informed the user about this renewal.
    if (kind === 'renewal_processed' && alreadyNotified.has(sourceId)) continue;
    eligible += 1;
    try {
      const record = await createInAppNotification({
        userId: ownerId,
        type: 'subscription_renewal',
        title: copy(subscription.name, kind),
        body:
          kind === 'renewal_processed'
            ? `₱${asNumber(occurrence.amount).toLocaleString('en-PH')} was recorded on ${occurrence.occurrence_date}`
            : `₱${asNumber(occurrence.amount).toLocaleString('en-PH')} · Renewal ${occurrence.occurrence_date}`,
        ...subscriptionReminderReference(
          subscription.id,
          occurrence.occurrence_date,
          validCycle(subscription.billing_cycle),
          kind,
        ),
      });
      if (!record) continue;
      const notification = {
        ...record,
        reminder_kind: kind,
        due_date: occurrence.occurrence_date,
        amount: asNumber(occurrence.amount),
      };
      notifications.push(notification);
      events.push({
        notification,
        subscription_id: subscription.id,
        name: subscription.name,
        amount: asNumber(occurrence.amount),
        occurrence_date: occurrence.occurrence_date,
        billing_cycle: validCycle(subscription.billing_cycle),
        wallet_id: occurrence.wallet_id ?? subscription.wallet_id ?? null,
        reminder_kind: kind,
      });
    } catch (error) {
      failed += 1;
      if (process.env.NODE_ENV !== 'production')
        console.warn('[notifications] subscription reminder candidate failed', {
          subscription_id: subscription.id,
          occurrence_date: occurrence.occurrence_date,
          code: (error as { code?: string })?.code ?? 'unknown',
        });
    }
  }
  return {
    notifications,
    events,
    eligible,
    created: notifications.length,
    skippedExisting: Math.max(0, eligible - notifications.length - failed),
    invalid: 0,
    failed,
  };
}

/** Used by tests and callers that need the next nominal occurrence. */
export function nextSubscriptionOccurrence(date: string, cycle: SubscriptionBillingCycle) {
  return addBillingCycle(date, cycle);
}
