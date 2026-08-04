import { asNumber, client, requireUserId, throwIfError, todayIso } from "./db.js";

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
  let query = client().from("subscriptions").select("*").is("deleted_at", null).order("renewal_date", { ascending: true });
  if (userId) query = query.eq("user_id", requireUserId(userId));
  const { data: subscriptions, error } = await query;
  throwIfError(error);

  let generated = 0;
  for (const subscription of subscriptions ?? []) {
    const cycle = cycleOf(subscription.billing_cycle);
    const occurrences = dueOccurrences(String(subscription.renewal_date), cycle, through);
    if (!occurrences.length) continue;

    for (const occurrence of occurrences) {
      const recurrenceKey = `${subscription.id}:${occurrence}:${cycle}`;
      const payload = {
        user_id: subscription.user_id,
        amount: asNumber(subscription.amount),
        category: "Subscriptions",
        merchant: String(subscription.name || "Subscription"),
        date: occurrence,
        payment_method: "other",
        subscription_id: subscription.id,
        billing_cycle: cycle,
        occurrence_date: occurrence,
        generated_by: "subscription",
        recurrence_key: recurrenceKey,
        billing_status: "generated",
        generated_at: new Date().toISOString(),
        deleted_at: null,
      };
      const { data, error: insertError } = await client()
        .from("expenses")
        .upsert(payload, { onConflict: "user_id,subscription_id,occurrence_date,billing_cycle", ignoreDuplicates: true })
        .select("id")
        .maybeSingle();
      throwIfError(insertError);
      if (data?.id) generated += 1;
    }

    const nextRenewalDate = addBillingCycle(occurrences[occurrences.length - 1], cycle);
    const { error: updateError } = await client()
      .from("subscriptions")
      .update({ renewal_date: nextRenewalDate })
      .eq("id", subscription.id)
      .eq("user_id", subscription.user_id)
      .is("deleted_at", null);
    throwIfError(updateError);
  }

  return { processed: subscriptions?.length ?? 0, generated };
}
