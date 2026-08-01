type SubscriptionBillingCycle = "monthly" | "yearly";

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function toDateOnly(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const originalDay = next.getUTCDate();

  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  next.setUTCDate(Math.min(originalDay, new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()));

  return next;
}

function todayInManila() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

export function getNextSubscriptionRenewalDate(
  renewalDate: string,
  billingCycle: SubscriptionBillingCycle,
  today = todayInManila(),
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(renewalDate)) {
    return renewalDate;
  }

  const stepMonths = billingCycle === "yearly" ? 12 : 1;
  let occurrence = parseDateOnly(renewalDate);

  while (toDateOnly(occurrence) < today) {
    occurrence = addMonths(occurrence, stepMonths);
  }

  return toDateOnly(occurrence);
}
