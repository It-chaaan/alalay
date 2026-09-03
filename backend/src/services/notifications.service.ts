import { asNumber, client, requireUserId, throwIfError, todayIso } from "./db.js";
import { getServiceSupabase } from '../config/supabase.js';

export type InAppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  related_bill_id?: string | null;
  related_bill_occurrence_id?: string | null;
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

export async function createInAppNotification(input: { userId: string; type: string; title: string; body: string; related_bill_id?: string | null; related_bill_occurrence_id?: string | null; related_subscription_id?: string | null; related_wallet_id?: string | null; period_key?: string | null; source_type?: string | null; source_id?: string | null; deduplication_key?: string | null; action?: { route?: string; params?: Record<string, string> } | null }) {
  const { userId, ...notification } = input;
  const ownerId = requireUserId(userId);
  // Notifications are server-authored. Request-scoped clients carry the
  // mobile JWT and correctly cannot INSERT under the inbox RLS policy; this
  // narrowly scoped write uses the backend-only service role instead.
  const admin = getServiceSupabase();
  const fields = "id, type, title, body, read_at, created_at, related_bill_id, related_bill_occurrence_id, related_subscription_id, related_wallet_id, source_type, source_id, action";
  const { data, error } = await admin.from("notifications").upsert({ user_id: ownerId, ...notification }, { onConflict: "user_id,deduplication_key", ignoreDuplicates: true }).select(fields).maybeSingle();
  if (error && process.env.NODE_ENV !== 'production') {
    console.warn('[notifications] server insert failed', { code: error.code ?? 'unknown', owner_id: ownerId, client_mode: 'service_role' });
  }
  throwIfError(error);
  if (data) return data as InAppNotification;
  if (!notification.deduplication_key) return null;
  const existing = await admin.from("notifications").select(fields).eq("user_id", ownerId).eq("deduplication_key", notification.deduplication_key).maybeSingle();
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

const reminderSelect = "bill_reminders, bill_reminder_three_days, bill_reminder_one_day, bill_reminder_due_day, bill_overdue_reminders";
const defaultBillReminderPrefs: BillReminderPrefs = { bill_reminders: true, bill_reminder_three_days: true, bill_reminder_one_day: true, bill_reminder_due_day: true, bill_overdue_reminders: true };

export function billReminderReference(parentBillId: string, occurrenceId: string, dueDate: string, reminderKind: string) {
  return {
    related_bill_id: parentBillId,
    related_bill_occurrence_id: occurrenceId,
    source_type: 'bill_occurrence',
    source_id: occurrenceId,
    deduplication_key: `bill-occurrence:${occurrenceId}:${dueDate}:${reminderKind}`,
    action: { route: '/(tabs)/bills', params: { occurrenceId, billId: parentBillId } },
  };
}

async function createBillReminder(userId: string, bill: { id: string; parent_bill_id?: string | null; title: string; amount: unknown; due_date: string; status?: string | null; recurring?: boolean | null; paid_occurrence_date?: string | null }, prefs: BillReminderPrefs, today: string) {
  if (!['unpaid', 'overdue'].includes(String(bill.status)) || (bill.recurring && bill.paid_occurrence_date === bill.due_date)) return null;
  const reminder = reminderKind(String(bill.due_date), prefs, today);
  if (!reminder) return null;
  const dueDate = String(bill.due_date).slice(0, 10);
  const title = `${String(bill.title)} ${reminder.label}`;
  const body = `₱${asNumber(bill.amount).toLocaleString("en-PH")} · Due ${dueDate}`;
  const reference = bill.parent_bill_id
    ? billReminderReference(bill.parent_bill_id, bill.id, dueDate, reminder.kind)
    : { related_bill_id: bill.id, related_bill_occurrence_id: null, source_type: 'bill', source_id: bill.id, deduplication_key: `bill:${bill.id}:${dueDate}:${reminder.kind}`, action: { route: '/(tabs)/bills', params: { billId: bill.id } } };
  const record = await createInAppNotification({
    userId, type: reminder.kind === "overdue" ? "bill_overdue" : "bill_due", title, body,
    ...reference,
  });
  return record ? { ...record, reminder_kind: reminder.kind, due_date: dueDate, amount: asNumber(bill.amount) } : null;
}

export async function reconcileBillReminder(userId: string, bill: { id: string; title: string; amount: unknown; due_date: string; status?: string | null; recurring?: boolean | null; paid_occurrence_date?: string | null }, now = new Date()) {
  const ownerId = requireUserId(userId);
  const prefsResult = await client().from("notification_preferences").select(reminderSelect).eq("user_id", ownerId).maybeSingle();
  throwIfError(prefsResult.error);
  return createBillReminder(ownerId, bill, { ...defaultBillReminderPrefs, ...(prefsResult.data ?? {}) } as BillReminderPrefs, todayIso(now));
}

/** Persist bill reminders before a device notification is scheduled. */
export async function syncBillReminders(userId: string, now = new Date()) {
  const ownerId = requireUserId(userId);
  const today = todayIso(now);
  const [prefsResult, billsResult] = await Promise.all([
    client().from("notification_preferences").select(reminderSelect).eq("user_id", ownerId).maybeSingle(),
    client().from("bill_occurrences").select("id, bill_id, occurrence_date, status, paid_at, bill:bills!inner(title, amount, recurring, deleted_at)").eq("user_id", ownerId).is("bill.deleted_at", null),
  ]);
  throwIfError(prefsResult.error);
  throwIfError(billsResult.error);
  const prefs = { ...defaultBillReminderPrefs, ...(prefsResult.data ?? {}) } as BillReminderPrefs;
  const result: InAppNotification[] = [];
  let eligible = 0; let skippedExisting = 0; let invalid = 0; let failed = 0;
  for (const row of billsResult.data ?? []) {
    const template = Array.isArray(row.bill) ? row.bill[0] : row.bill;
    if (!row.bill_id || !row.id || !template) { invalid += 1; continue; }
    const bill = { id: row.id, parent_bill_id: row.bill_id, title: template.title ?? 'Bill', amount: template.amount ?? 0, due_date: row.occurrence_date, status: row.status, recurring: false, paid_occurrence_date: null };
    try {
      const record = await createBillReminder(ownerId, bill, prefs, today);
      if (record) { result.push(record); eligible += 1; }
      else skippedExisting += 1;
    } catch (error) {
      failed += 1;
      if (process.env.NODE_ENV !== 'production') console.warn('[notifications] bill reminder candidate failed', { occurrence_id: row.id, parent_bill_id: row.bill_id, code: (error as { code?: string })?.code ?? 'unknown' });
    }
  }
  return { notifications: result, eligible, created: result.length, skippedExisting, invalid, failed };
}

export async function listNotifications(userId: string) {
  const { data, error } = await client().from("notifications").select("id, type, title, body, read_at, created_at, related_bill_id, related_bill_occurrence_id, related_subscription_id, related_wallet_id, source_type, source_id, action").eq("user_id", requireUserId(userId)).order("created_at", { ascending: false }).limit(100);
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
