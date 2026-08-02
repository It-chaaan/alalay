import { env } from "../config/env.js";
import { client, previousMonthRange, todayIso, asNumber, throwIfError } from "./db.js";
import { getReports } from "./analytics.service.js";
import { billDueEmail, monthlySummaryEmail, sendEmail, subscriptionRenewalEmail } from "./notification-email.service.js";

type Preferences = { bill_reminders: boolean; bill_reminder_days: number; subscription_reminders: boolean; summaries: boolean };
type AuthUser = { id: string; email?: string | null; user_metadata?: Record<string, unknown> };

const defaults: Preferences = { bill_reminders: true, bill_reminder_days: 3, subscription_reminders: true, summaries: false };

function dateAfter(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function shouldSendReminder(enabled: boolean, dueDate: string, today: string, days: number) {
  return enabled && dueDate === dateAfter(today, days);
}

export function shouldSendMonthlySummary(enabled: boolean, today: string) {
  return enabled && today.endsWith("-01");
}

function nextRenewalDate(date: string, cycle: string, today: string) {
  const current = new Date(`${date}T00:00:00Z`);
  const now = new Date(`${today}T00:00:00Z`);
  while (current < now) {
    if (cycle === "yearly") current.setUTCFullYear(current.getUTCFullYear() + 1);
    else current.setUTCMonth(current.getUTCMonth() + 1);
  }
  return current.toISOString().slice(0, 10);
}

async function authUsers() {
  const users: AuthUser[] = [];
  for (let page = 1; ; page += 1) {
    const result = await client().auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    users.push(...(result.data.users as AuthUser[]));
    if (result.data.users.length < 1000) return users;
  }
}

async function logFailure(userId: string, email: string, type: string, related: Record<string, unknown>, error: unknown, today: string, periodKey?: string) {
  const { error: logError } = await client().from("notifications_log").insert({ user_id: userId, recipient_email: email, type, ...related, period_key: periodKey ?? null, sent_on: today, status: "failed", error: error instanceof Error ? error.message : String(error) });
  if (logError) console.error("Unable to log notification failure:", logError.message);
}

async function sendLogged(user: AuthUser, type: string, email: string, input: { subject: string; html: string }, related: Record<string, unknown>, today: string, periodKey?: string) {
  const query = client().from("notifications_log").select("id").eq("user_id", user.id).eq("type", type).eq("sent_on", today).eq("status", "sent");
  for (const [key, value] of Object.entries(related)) query.eq(key, value);
  if (periodKey) query.eq("period_key", periodKey);
  const { data: existing, error: existingError } = await query.limit(1);
  throwIfError(existingError);
  if (existing?.length) return false;

  try {
    await sendEmail({ to: email, ...input });
    const { error } = await client().from("notifications_log").insert({ user_id: user.id, recipient_email: email, type, ...related, period_key: periodKey ?? null, sent_on: today, status: "sent", sent_at: new Date().toISOString() });
    if (error) throw error;
    return true;
  } catch (error) {
    await logFailure(user.id, email, type, related, error, today, periodKey);
    console.error(`Notification ${type} failed for ${email}:`, error);
    return false;
  }
}

export async function runNotificationScheduler(now = new Date()) {
  const today = todayIso(now);
  const [users, preferencesResult, billsResult, subscriptionsResult] = await Promise.all([
    authUsers(),
    client().from("notification_preferences").select("*"),
    client().from("bills").select("*").eq("status", "unpaid").is("deleted_at", null),
    client().from("subscriptions").select("*").eq("auto_renew", true).is("deleted_at", null),
  ]);
  throwIfError(preferencesResult.error);
  throwIfError(billsResult.error);
  throwIfError(subscriptionsResult.error);
  const preferences = new Map((preferencesResult.data ?? []).map((row) => [row.user_id, { ...defaults, ...row }]));
  const userMap = new Map(users.filter((user) => user.email).map((user) => [user.id, user]));

  for (const bill of billsResult.data ?? []) {
    const user = userMap.get(bill.user_id);
    const prefs = preferences.get(bill.user_id) as Preferences | undefined;
    if (!user?.email || !prefs?.bill_reminders) continue;
    const days = Number(prefs.bill_reminder_days);
    if (!shouldSendReminder(prefs.bill_reminders, bill.due_date, today, days)) continue;
    await sendLogged(user, "bill_due", user.email, billDueEmail({ title: bill.title, amount: asNumber(bill.amount), due_date: bill.due_date }, days), { related_bill_id: bill.id }, today);
  }

  for (const subscription of subscriptionsResult.data ?? []) {
    const user = userMap.get(subscription.user_id);
    const prefs = preferences.get(subscription.user_id) as Preferences | undefined;
    if (!user?.email || !prefs?.subscription_reminders) continue;
    const renewalDate = nextRenewalDate(subscription.renewal_date, subscription.billing_cycle, today);
    const days = Number(prefs.bill_reminder_days);
    if (!shouldSendReminder(prefs.subscription_reminders, renewalDate, today, days)) continue;
    await sendLogged(user, "subscription_renewal", user.email, subscriptionRenewalEmail({ name: subscription.name, amount: asNumber(subscription.amount), renewal_date: renewalDate }, days), { related_subscription_id: subscription.id }, today);
  }

  if (shouldSendMonthlySummary(true, today)) {
    const range = previousMonthRange(now);
    const periodKey = range.start.slice(0, 7);
    const month = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(`${range.start}T12:00:00Z`));
    for (const user of users) {
      const prefs = preferences.get(user.id) as Preferences | undefined;
      if (!user.email || !prefs?.summaries) continue;
      try {
        const report = await getReports(user.id, { period: "custom", from: range.start, to: range.end }) as { total_income: number; total_expenses: number; total_bills_paid: number; outstanding_bills: number; savings?: { goal_progress?: number }; budget?: { utilization_percent?: number } };
        await sendLogged(user, "monthly_summary", user.email, monthlySummaryEmail({ month, income: report.total_income, expenses: report.total_expenses, billsPaid: report.total_bills_paid, billsOutstanding: report.outstanding_bills, savingsProgress: report.savings?.goal_progress ?? 0, budgetPerformance: report.budget?.utilization_percent ?? 0 }), {}, today, periodKey);
      } catch (error) {
        await logFailure(user.id, user.email, "monthly_summary", {}, error, today, periodKey);
        console.error(`Monthly summary failed for ${user.email}:`, error);
      }
    }
  }
}

export function startNotificationScheduler() {
  if (!env.NOTIFICATION_SCHEDULER_ENABLED) return;
  const run = () => void runNotificationScheduler().catch((error) => console.error("Notification scheduler failed:", error));
  const now = new Date();
  const next = new Date(now);
  next.setHours(9, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  setTimeout(() => { run(); setInterval(run, 24 * 60 * 60 * 1000); }, Math.max(1000, next.getTime() - now.getTime()));
  console.log(`Notification scheduler enabled; next run at ${next.toISOString()}.`);
}
