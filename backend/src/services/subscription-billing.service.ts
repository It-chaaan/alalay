import { asNumber, client, requireUserId, throwIfError, todayIso } from "./db.js";
import { env } from "../config/env.js";

export type SubscriptionBillingCycle = "weekly" | "monthly" | "quarterly" | "yearly";

function parseDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function addBillingCycle(date: string, cycle: SubscriptionBillingCycle) {
  const current = parseDate(date);
  if (cycle === "weekly") current.setUTCDate(current.getUTCDate() + 7);
  else {
    const months = cycle === "quarterly" ? 3 : cycle === "yearly" ? 12 : 1;
    const originalDay = current.getUTCDate();
    current.setUTCDate(1);
    current.setUTCMonth(current.getUTCMonth() + months);
    current.setUTCDate(Math.min(originalDay, daysInMonth(current.getUTCFullYear(), current.getUTCMonth())));
  }
  return dateKey(current);
}

function cycleOf(value: unknown): SubscriptionBillingCycle {
  const cycle = String(value ?? "monthly").toLowerCase();
  return cycle === "weekly" || cycle === "quarterly" || cycle === "yearly" ? cycle : "monthly";
}

export function dueOccurrences(renewalDate: string, cycle: SubscriptionBillingCycle, through: string) {
  const occurrences: string[] = [];
  let occurrence = renewalDate.slice(0, 10);
  while (occurrence <= through) {
    occurrences.push(occurrence);
    occurrence = addBillingCycle(occurrence, cycle);
  }
  return occurrences;
}

export type UpcomingSubscription = {
  id: string;
  name: string;
  amount: number;
  renewal_date: string;
  billing_cycle: SubscriptionBillingCycle;
  wallet_id?: string | null;
  auto_renew?: boolean;
};

export type WalletFundingWarning = {
  walletId: string;
  renewalDate: string;
  subscriptionCount: number;
  total: number;
  balance: number;
  shortfall: number;
  subscriptionNames: string[];
};

function addDays(date: string, days: number) {
  const value = parseDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return dateKey(value);
}

export function nextUpcomingRenewal(renewalDate: string, cycle: SubscriptionBillingCycle, today: string) {
  let next = renewalDate.slice(0, 10);
  while (next < today) next = addBillingCycle(next, cycle);
  return next;
}

/**
 * Projects obligations without changing wallet balances. A warning is emitted
 * only when the earliest upcoming renewal is exactly the reminder date, and it
 * includes every same-wallet obligation due on or before that date.
 */
export function projectWalletFundingWarnings(
  subscriptions: UpcomingSubscription[],
  walletBalances: Map<string, number>,
  today: string,
  reminderDays = 3,
): WalletFundingWarning[] {
  const reminderDate = addDays(today, reminderDays);
  const groups = new Map<string, Array<UpcomingSubscription & { effectiveRenewalDate: string }>>();
  for (const subscription of subscriptions) {
    if (subscription.auto_renew === false || !subscription.wallet_id) continue;
    const effectiveRenewalDate = nextUpcomingRenewal(subscription.renewal_date, subscription.billing_cycle, today);
    const rows = groups.get(subscription.wallet_id) ?? [];
    rows.push({ ...subscription, effectiveRenewalDate });
    groups.set(subscription.wallet_id, rows);
  }

  const warnings: WalletFundingWarning[] = [];
  for (const [walletId, rows] of groups) {
    const triggerDates = [...new Set(rows.map((row) => row.effectiveRenewalDate).filter((date) => date === reminderDate))];
    const balance = walletBalances.get(walletId) ?? 0;
    for (const renewalDate of triggerDates) {
      const obligations = rows.filter((row) => row.effectiveRenewalDate <= renewalDate);
      const total = obligations.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
      if (total <= balance) continue;
      warnings.push({
        walletId,
        renewalDate,
        subscriptionCount: obligations.length,
        total,
        balance,
        shortfall: total - balance,
        subscriptionNames: obligations.map((row) => row.name),
      });
    }
  }
  return warnings;
}

export async function processSubscriptionBilling(userId?: string, now = new Date()) {
  const through = todayIso(now);
  const log = (event: string, details: Record<string, unknown> = {}) => {
    if (env.BILLING_DEBUG) console.info(`[subscription-billing] ${event}`, { current_date: through, ...details });
  };
  log("started", { user_id: userId ?? "all" });
  const { data, error } = await client().rpc('process_subscription_billing_occurrences', {
    target_user_id: userId ? requireUserId(userId) : null,
    target_through: through,
  });
  if (error) log('rpc_failed', { error: error.message });
  throwIfError(error);
  const summary = Array.isArray(data) ? data[0] : data;
  const result = {
    processed: Number(summary?.processed ?? 0),
    generated: Number(summary?.expenses_created ?? 0),
    occurrencesCreated: Number(summary?.occurrences_created ?? 0),
    duplicatesSkipped: Number(summary?.duplicates_skipped ?? 0),
    failed: Number(summary?.failed ?? 0),
  };
  log('finished', result);
  return result;
}
