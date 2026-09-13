import { processSubscriptionBilling } from "./subscription-billing.service.js";
import { client, throwIfError } from './db.js';

const BILLING_INTERVAL_MS = 60 * 60 * 1000;

export async function runBillingScheduler() {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const [subscriptionResult, occurrencesResult] = await Promise.all([
    processSubscriptionBilling(),
    client().rpc('reconcile_bill_occurrences', { target_user_id: null }),
  ]);
  throwIfError(occurrencesResult.error);
  const summary = { run_id: runId, started_at: startedAt, finished_at: new Date().toISOString(), subscriptionsProcessed: subscriptionResult, billOccurrencesReconciled: true };
  console.info('[billing-scheduler] completed', summary);
  return summary;
}

export function startBillingScheduler() {
  const run = () => void runBillingScheduler().catch((error) => console.error("Billing recurrence failed:", error));
  run();
  setInterval(run, BILLING_INTERVAL_MS);
  console.log("Subscription billing scheduler enabled; running hourly.");
}
