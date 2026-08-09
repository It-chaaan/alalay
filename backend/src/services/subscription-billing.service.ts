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

export async function processSubscriptionBilling(userId?: string, now = new Date()) {
  const through = todayIso(now);
  const log = (event: string, details: Record<string, unknown> = {}) => {
    if (env.BILLING_DEBUG) console.info(`[subscription-billing] ${event}`, { current_date: through, ...details });
  };
  log("started", { user_id: userId ?? "all" });
  let query = client().from("subscriptions").select("*").is("deleted_at", null).order("renewal_date", { ascending: true });
  if (userId) query = query.eq("user_id", requireUserId(userId));
  const { data: subscriptions, error } = await query;
  if (error) log("subscription_query_failed", { error: error.message });
  throwIfError(error);

  let generated = 0;
  for (const subscription of subscriptions ?? []) {
    const cycle = cycleOf(subscription.billing_cycle);
    const occurrences = dueOccurrences(String(subscription.renewal_date), cycle, through);
    log("subscription_checked", {
      subscription_id: subscription.id,
      renewal_date: String(subscription.renewal_date).slice(0, 10),
      billing_cycle: cycle,
      due: occurrences.length > 0,
      occurrences,
    });
    if (!occurrences.length) continue;

    for (const occurrence of occurrences) {
      const { data: existing, error: duplicateError } = await client()
        .from("expenses")
        .select("id")
        .eq("user_id", subscription.user_id)
        .eq("subscription_id", subscription.id)
        .eq("occurrence_date", occurrence)
        .eq("billing_cycle", cycle)
        .limit(1)
        .maybeSingle();
      if (duplicateError) log("duplicate_check_failed", { subscription_id: subscription.id, occurrence_date: occurrence, error: duplicateError.message });
      throwIfError(duplicateError);
      log("duplicate_checked", {
        subscription_id: subscription.id,
        occurrence_date: occurrence,
        duplicate: Boolean(existing?.id),
      });
      if (existing?.id) continue;

      const recurrenceKey = `${subscription.id}:${occurrence}:${cycle}`;
      const payload = {
        user_id: subscription.user_id,
        amount: asNumber(subscription.amount),
        category: "Subscriptions",
        merchant: `${String(subscription.name || "Subscription")} Subscription`,
        date: occurrence,
        payment_method: "other",
        subscription_id: subscription.id,
        billing_cycle: cycle,
        occurrence_date: occurrence,
        generated_by: "subscription",
        recurrence_key: recurrenceKey,
        billing_status: "generated",
        generated_at: new Date().toISOString(),
        wallet_id: subscription.wallet_id ?? null,
        deleted_at: null,
      };
      const { data, error: insertError } = await client()
        .from("expenses")
        .upsert(payload, { onConflict: "user_id,subscription_id,occurrence_date,billing_cycle", ignoreDuplicates: true })
        .select("id")
        .maybeSingle();
      if (insertError) log("expense_insert_failed", { subscription_id: subscription.id, occurrence_date: occurrence, error: insertError.message });
      throwIfError(insertError);
      log("expense_inserted", {
        subscription_id: subscription.id,
        occurrence_date: occurrence,
        expense_id: data?.id ?? null,
        inserted: Boolean(data?.id),
      });
      if (data?.id) generated += 1;
    }

    const nextRenewalDate = addBillingCycle(occurrences[occurrences.length - 1], cycle);
    const { error: updateError } = await client()
      .from("subscriptions")
      .update({ renewal_date: nextRenewalDate })
      .eq("id", subscription.id)
      .eq("user_id", subscription.user_id)
      .is("deleted_at", null);
    if (updateError) log("renewal_update_failed", { subscription_id: subscription.id, renewal_date: nextRenewalDate, error: updateError.message });
    throwIfError(updateError);
    log("renewal_updated", {
      subscription_id: subscription.id,
      renewal_date: nextRenewalDate,
    });
  }

  log("finished", { processed: subscriptions?.length ?? 0, generated });
  return { processed: subscriptions?.length ?? 0, generated };
}
