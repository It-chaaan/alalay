import { processSubscriptionBilling } from "./subscription-billing.service.js";

const BILLING_INTERVAL_MS = 60 * 60 * 1000;

export function startBillingScheduler() {
  const run = () => void processSubscriptionBilling().catch((error) => console.error("Subscription billing failed:", error));
  run();
  setInterval(run, BILLING_INTERVAL_MS);
  console.log("Subscription billing scheduler enabled; running hourly.");
}
