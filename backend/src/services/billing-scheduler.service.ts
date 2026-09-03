import { processSubscriptionBilling } from "./subscription-billing.service.js";
import { client, throwIfError } from './db.js';

const BILLING_INTERVAL_MS = 60 * 60 * 1000;

export function startBillingScheduler() {
  const run = () => void Promise.all([
    processSubscriptionBilling(),
    client().rpc('reconcile_bill_occurrences', { target_user_id: null }).then(({ error }) => throwIfError(error)),
  ]).catch((error) => console.error("Billing recurrence failed:", error));
  run();
  setInterval(run, BILLING_INTERVAL_MS);
  console.log("Subscription billing scheduler enabled; running hourly.");
}
