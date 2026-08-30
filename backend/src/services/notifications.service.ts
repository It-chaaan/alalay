import { asNumber, client, requireUserId, throwIfError, todayIso } from "./db.js";

export type InAppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  related_bill_id?: string | null;
  related_subscription_id?: string | null;
  related_wallet_id?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  action?: { route?: string; params?: Record<string, string> } | null;
  reminder_kind?: string | null;
  due_date?: string | null;
  amount?: number | null;
};

export const NOTIFICATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function notificationCutoff(now = new Date()) {
  return new Date(now.getTime() - NOTIFICATION_WINDOW_MS).toISOString();
}

export async function createInAppNotification(input: { userId: string; type: string; title: string; body: string; related_bill_id?: string | null; related_subscription_id?: string | null; related_wallet_id?: string | null; period_key?: string | null; source_type?: string | null; source_id?: string | null; deduplication_key?: string | null; action?: { route?: string; params?: Record<string, string> } | null }) {
  const { userId, ...notification } = input;
  const { data, error } = await client().from("notifications").upsert({ user_id: requireUserId(userId), ...notification }, { onConflict: "user_id,deduplication_key", ignoreDuplicates: true }).select("id, type, title, body, read_at, created_at, related_bill_id, related_subscription_id, related_wallet_id, source_type, source_id, action").maybeSingle();
  throwIfError(error);
  if (data) return data as InAppNotification;
  if (!notification.deduplication_key) return null;
  const existing = await client().from("notifications").select("id, type, title, body, read_at, created_at, related_bill_id, related_subscription_id, related_wallet_id, source_type, source_id, action").eq("user_id", requireUserId(userId)).eq("deduplication_key", notification.deduplication_key).maybeSingle();
  throwIfError(existing.error);
  return existing.data as InAppNotification | null;
}

type BillReminderPrefs = {
  bill_reminders: boolean;
  bill_reminder_three_days: boolean;
  bill_reminder_one_day: boolean;
  bill_reminder_due_day: boolean;
  bill_overdue_reminders: boolean;
};

function dateAfter(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function reminderKind(dueDate: string, prefs: BillReminderPrefs, today: string) {
  if (!prefs.bill_reminders) return null;
  if (prefs.bill_reminder_three_days && dueDate === dateAfter(today, 3)) return { kind: "three_days_before", label: "due in 3 days" };
  if (prefs.bill_reminder_one_day && dueDate === dateAfter(today, 1)) return { kind: "one_day_before", label: "due tomorrow" };
  if (prefs.bill_reminder_due_day && dueDate === today) return { kind: "due_day", label: "due today" };
  if (prefs.bill_overdue_reminders && dueDate === dateAfter(today, -1)) return { kind: "overdue", label: "is overdue" };
  return null;
}

/** Persist bill reminders before a device notification is scheduled. */
export async function syncBillReminders(userId: string, now = new Date()) {
  const ownerId = requireUserId(userId);
  const today = todayIso(now);
  const [prefsResult, billsResult] = await Promise.all([
    client().from("notification_preferences").select("bill_reminders, bill_reminder_three_days, bill_reminder_one_day, bill_reminder_due_day, bill_overdue_reminders").eq("user_id", ownerId).maybeSingle(),
    client().from("bills").select("id, title, amount, due_date, status, recurring, paid_occurrence_date, deleted_at").eq("user_id", ownerId).is("deleted_at", null),
  ]);
  throwIfError(prefsResult.error);
  throwIfError(billsResult.error);
  const prefs = { bill_reminders: true, bill_reminder_three_days: true, bill_reminder_one_day: true, bill_reminder_due_day: true, bill_overdue_reminders: true, ...(prefsResult.data ?? {}) } as BillReminderPrefs;
  const result: InAppNotification[] = [];
  for (const bill of billsResult.data ?? []) {
    if (!['unpaid', 'overdue'].includes(String(bill.status)) || (bill.recurring && bill.paid_occurrence_date === bill.due_date)) continue;
    const reminder = reminderKind(String(bill.due_date), prefs, today);
    if (!reminder) continue;
    const dueDate = String(bill.due_date).slice(0, 10);
    const title = `${String(bill.title)} ${reminder.label}`;
    const body = `₱${asNumber(bill.amount).toLocaleString("en-PH")} · Due ${dueDate}`;
    const record = await createInAppNotification({ userId: ownerId, type: reminder.kind === "overdue" ? "bill_overdue" : "bill_due", title, body, related_bill_id: bill.id, source_type: "bill", source_id: bill.id, deduplication_key: `bill:${bill.id}:${dueDate}:${reminder.kind}`, action: { route: "/(tabs)/bills", params: { billId: bill.id } } });
    if (record) result.push({ ...record, reminder_kind: reminder.kind, due_date: dueDate, amount: asNumber(bill.amount) });
  }
  return result;
}

export async function listNotifications(userId: string) {
  const { data, error } = await client().from("notifications").select("id, type, title, body, read_at, created_at, related_bill_id, related_subscription_id, related_wallet_id, source_type, source_id, action").eq("user_id", requireUserId(userId)).order("created_at", { ascending: false }).limit(100);
  throwIfError(error);
  return (data ?? []) as InAppNotification[];
}

export async function unreadNotificationCount(userId: string) {
  const { count, error } = await client().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", requireUserId(userId)).is("read_at", null);
  throwIfError(error);
  return count ?? 0;
}

export async function markNotificationsRead(userId: string) {
  const { error } = await client().from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("user_id", requireUserId(userId)).is("read_at", null);
  throwIfError(error);
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const { error } = await client().from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("id", notificationId).eq("user_id", requireUserId(userId));
  throwIfError(error);
}

export async function markNotificationUnread(userId: string, notificationId: string) {
  const { error } = await client().from("notifications").update({ read: false, read_at: null }).eq("id", notificationId).eq("user_id", requireUserId(userId));
  throwIfError(error);
}
