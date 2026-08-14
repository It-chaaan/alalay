import { env } from "../config/env.js";
import { client, previousMonthRange, todayIso, asNumber, throwIfError } from "./db.js";
import { getReports } from "./analytics.service.js";
import { billDueEmail, billOverdueEmail, monthlySummaryEmail, sendEmail, subscriptionFundingWarningEmail, subscriptionRenewalEmail } from "./notification-email.service.js";
import { addBillingCycle, projectWalletFundingWarnings, type SubscriptionBillingCycle, type UpcomingSubscription } from "./subscription-billing.service.js";
import { createInAppNotification } from "./notifications.service.js";

type Preferences = { bill_reminders: boolean; bill_reminder_days: number; bill_reminder_three_days: boolean; bill_reminder_one_day: boolean; bill_reminder_due_day: boolean; bill_overdue_reminders: boolean; subscription_reminders: boolean; summaries: boolean; overspending_alerts: boolean };
type AuthUser = { id: string; email?: string | null; user_metadata?: Record<string, unknown> };

const defaults: Preferences = { bill_reminders: true, bill_reminder_days: 3, bill_reminder_three_days: true, bill_reminder_one_day: true, bill_reminder_due_day: true, bill_overdue_reminders: true, subscription_reminders: true, summaries: false, overspending_alerts: true };

function dateAfter(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function shouldSendReminder(enabled: boolean, dueDate: string, today: string, days: number) {
  return enabled && dueDate === dateAfter(today, days);
}

export function billReminder(bill: { due_date: string }, prefs: Preferences, today: string) {
  if (!prefs.bill_reminders) return null;
  if (prefs.bill_reminder_three_days && shouldSendReminder(true, bill.due_date, today, 3)) return { type: "bill_due", days: 3 } as const;
  if (prefs.bill_reminder_one_day && shouldSendReminder(true, bill.due_date, today, 1)) return { type: "bill_due", days: 1 } as const;
  if (prefs.bill_reminder_due_day && bill.due_date === today) return { type: "bill_due", days: 0 } as const;
  if (prefs.bill_overdue_reminders && bill.due_date === dateAfter(today, -1)) return { type: "bill_overdue" } as const;
  return null;
}

export function shouldSendMonthlySummary(enabled: boolean, today: string) {
  return enabled && today.endsWith("-01");
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

  await createInAppNotification({ userId: user.id, type, title: input.subject, body: input.subject, related_bill_id: typeof related.related_bill_id === "string" ? related.related_bill_id : null, related_subscription_id: typeof related.related_subscription_id === "string" ? related.related_subscription_id : null, related_wallet_id: typeof related.related_wallet_id === "string" ? related.related_wallet_id : null, period_key: periodKey ?? null });

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
  const [users, preferencesResult, billsResult, subscriptionsResult, walletsResult] = await Promise.all([
    authUsers(),
    client().from("notification_preferences").select("*"),
    client().from("bills").select("*").eq("status", "unpaid").is("deleted_at", null),
    client().from("subscriptions").select("*").eq("auto_renew", true).is("deleted_at", null),
    client().from("wallets").select("id, user_id, name, balance"),
  ]);
  throwIfError(preferencesResult.error);
  throwIfError(billsResult.error);
  throwIfError(subscriptionsResult.error);
  throwIfError(walletsResult.error);
  const preferences = new Map((preferencesResult.data ?? []).map((row) => [row.user_id, { ...defaults, ...row }]));
  const userMap = new Map(users.filter((user) => user.email).map((user) => [user.id, user]));
  const walletMap = new Map((walletsResult.data ?? []).map((wallet) => [wallet.id, wallet]));

  for (const bill of billsResult.data ?? []) {
    const user = userMap.get(bill.user_id);
    const prefs = preferences.get(bill.user_id) as Preferences | undefined;
    if (!user?.email || !prefs) continue;
    const reminder = billReminder(bill, prefs, today);
    if (!reminder) continue;
    const content = reminder.type === "bill_overdue" ? billOverdueEmail({ title: bill.title, amount: asNumber(bill.amount), due_date: bill.due_date }) : billDueEmail({ title: bill.title, amount: asNumber(bill.amount), due_date: bill.due_date }, reminder.days);
    await sendLogged(user, reminder.type, user.email, content, { related_bill_id: bill.id }, today);
  }

  for (const subscription of subscriptionsResult.data ?? []) {
    const user = userMap.get(subscription.user_id);
    const prefs = preferences.get(subscription.user_id) as Preferences | undefined;
    if (!user?.email || !prefs) continue;
    let renewalDate = String(subscription.renewal_date);
    const cycle = (String(subscription.billing_cycle).toLowerCase() as SubscriptionBillingCycle);
    while (renewalDate < today) renewalDate = addBillingCycle(renewalDate, cycle);
    const days = 3;
    if (prefs.subscription_reminders && shouldSendReminder(true, renewalDate, today, days)) {
      const wallet = subscription.wallet_id ? walletMap.get(subscription.wallet_id) : undefined;
      await sendLogged(user, "subscription_renewal", user.email, subscriptionRenewalEmail({ name: subscription.name, amount: asNumber(subscription.amount), renewal_date: renewalDate, wallet_name: wallet?.name }, days), { related_subscription_id: subscription.id }, today, renewalDate);
    }
  }

  const subscriptionsByUser = new Map<string, UpcomingSubscription[]>();
  for (const subscription of subscriptionsResult.data ?? []) {
    const rows = subscriptionsByUser.get(subscription.user_id) ?? [];
    rows.push({
      id: subscription.id,
      name: String(subscription.name),
      amount: asNumber(subscription.amount),
      renewal_date: String(subscription.renewal_date),
      billing_cycle: String(subscription.billing_cycle).toLowerCase() as SubscriptionBillingCycle,
      wallet_id: subscription.wallet_id,
      auto_renew: subscription.auto_renew,
    });
    subscriptionsByUser.set(subscription.user_id, rows);
  }
  for (const [userId, subscriptions] of subscriptionsByUser) {
    const user = userMap.get(userId);
    const prefs = preferences.get(userId) as Preferences | undefined;
    if (!user?.email || !prefs?.overspending_alerts) continue;
    const balances = new Map<string, number>();
    for (const wallet of walletsResult.data ?? []) {
      if (wallet.user_id === userId) balances.set(wallet.id, asNumber(wallet.balance));
    }
    const warnings = projectWalletFundingWarnings(subscriptions, balances, today, 3);
    for (const warning of warnings) {
      const wallet = walletMap.get(warning.walletId);
      if (!wallet) continue;
      await sendLogged(user, "subscription_funding_warning", user.email, subscriptionFundingWarningEmail({ wallet_name: wallet.name, total: warning.total, balance: warning.balance, shortfall: warning.shortfall, subscription_count: warning.subscriptionCount, renewal_date: warning.renewalDate }), { related_wallet_id: warning.walletId }, today, warning.renewalDate);
    }
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
  const [year, month, day] = todayIso(now).split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day, 1, 0, 0, 0));
  if (next <= now) next.setDate(next.getDate() + 1);
  setTimeout(() => { run(); setInterval(run, 24 * 60 * 60 * 1000); }, Math.max(1000, next.getTime() - now.getTime()));
  console.log(`Notification scheduler enabled; next run at ${next.toISOString()}.`);
}
