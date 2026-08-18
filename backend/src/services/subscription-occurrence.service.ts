import { client, requireUserId, throwIfError, todayIso } from './db.js';
import type { SubscriptionBillingCycle } from './subscription-billing.service.js';

type SubscriptionRecord = {
  id: string;
  user_id: string;
  renewal_date: string;
  billing_cycle: SubscriptionBillingCycle;
  created_at: string;
  [key: string]: unknown;
};

type SubscriptionExpense = {
  subscription_id: string | null;
  occurrence_date: string | null;
};

function parseDate(date: string) {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function subtractSubscriptionCycle(date: string, cycle: SubscriptionBillingCycle) {
  const current = parseDate(date);
  if (cycle === 'weekly') {
    current.setUTCDate(current.getUTCDate() - 7);
    return dateKey(current);
  }

  const months = cycle === 'quarterly' ? 3 : cycle === 'yearly' ? 12 : 1;
  const day = current.getUTCDate();
  current.setUTCDate(1);
  current.setUTCMonth(current.getUTCMonth() - months);
  current.setUTCDate(Math.min(day, daysInMonth(current.getUTCFullYear(), current.getUTCMonth())));
  return dateKey(current);
}

function periodKey(date: string, cycle: SubscriptionBillingCycle) {
  const [year, month] = date.slice(0, 10).split('-').map(Number);
  if (cycle === 'yearly') return String(year);
  if (cycle === 'quarterly') return `${year}-Q${Math.ceil(month / 3)}`;
  if (cycle === 'weekly') return date;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Exposes the paid/current cycle separately from a series' next renewal. This
 * keeps a paid August subscription visible through August after the scheduler
 * advances its stored renewal date to September.
 */
export function selectCurrentSubscriptionOccurrence(
  subscription: SubscriptionRecord,
  paidOccurrenceDates: ReadonlySet<string>,
  today: string,
) {
  const nextRenewalDate = subscription.renewal_date.slice(0, 10);
  const previousOccurrenceDate = subtractSubscriptionCycle(
    nextRenewalDate,
    subscription.billing_cycle,
  );
  const createdDate = subscription.created_at.slice(0, 10);

  if (nextRenewalDate <= today) {
    return {
      current_occurrence_date: nextRenewalDate,
      current_status: paidOccurrenceDates.has(nextRenewalDate)
        ? 'paid'
        : nextRenewalDate < today
          ? 'overdue'
          : 'due_today',
      next_renewal_date: null,
    };
  }

  if (
    previousOccurrenceDate >= createdDate &&
    periodKey(previousOccurrenceDate, subscription.billing_cycle) ===
      periodKey(today, subscription.billing_cycle)
  ) {
    return {
      current_occurrence_date: previousOccurrenceDate,
      current_status: paidOccurrenceDates.has(previousOccurrenceDate)
        ? 'paid'
        : previousOccurrenceDate < today
          ? 'overdue'
          : 'upcoming',
      next_renewal_date: nextRenewalDate,
    };
  }

  if (
    previousOccurrenceDate >= createdDate &&
    previousOccurrenceDate < today &&
    !paidOccurrenceDates.has(previousOccurrenceDate)
  ) {
    return {
      current_occurrence_date: previousOccurrenceDate,
      current_status: 'overdue',
      next_renewal_date: nextRenewalDate,
    };
  }

  return {
    current_occurrence_date: nextRenewalDate,
    current_status: nextRenewalDate === today ? 'due_today' : 'upcoming',
    next_renewal_date: nextRenewalDate,
  };
}

export async function listSubscriptionsWithOccurrences(userId: string) {
  const ownerId = requireUserId(userId);
  const { data: subscriptions, error } = await client()
    .from('subscriptions')
    .select('*')
    .eq('user_id', ownerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  throwIfError(error);

  const ids = (subscriptions ?? []).map((subscription) => subscription.id);
  const { data: expenses, error: expensesError } = ids.length
    ? await client()
        .from('expenses')
        .select('subscription_id, occurrence_date')
        .eq('user_id', ownerId)
        .in('subscription_id', ids)
        .is('deleted_at', null)
    : { data: [], error: null };
  throwIfError(expensesError);

  const paidBySubscription = new Map<string, Set<string>>();
  for (const expense of (expenses ?? []) as SubscriptionExpense[]) {
    if (!expense.subscription_id || !expense.occurrence_date) continue;
    const dates = paidBySubscription.get(expense.subscription_id) ?? new Set<string>();
    dates.add(expense.occurrence_date.slice(0, 10));
    paidBySubscription.set(expense.subscription_id, dates);
  }

  const today = todayIso();
  return (subscriptions ?? []).map((subscription) => ({
    ...subscription,
    ...selectCurrentSubscriptionOccurrence(
      subscription as SubscriptionRecord,
      paidBySubscription.get(subscription.id) ?? new Set<string>(),
      today,
    ),
  }));
}
