import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { SECURE_STORAGE_KEYS, reminderStorageKey } from '@/constants/secure-storage-keys';

import { authenticatedApiRequest } from './api';
import { syncBillReminders, syncSubscriptionReminders } from './notifications';
import { dateKeyInManila, fetchFinanceItems, type FinanceItem } from './finance';
import { getSupabaseClient } from './supabase';

export type ReminderKind = 'three_days_before' | 'one_day_before' | 'due_day' | 'overdue';
type ReminderPreferences = { bill_reminders: boolean; bill_reminder_days: number; bill_reminder_three_days: boolean; bill_reminder_one_day: boolean; bill_reminder_due_day: boolean; bill_overdue_reminders: boolean; bill_reminder_hour: number; bill_reminder_minute: number; subscription_reminders: boolean; subscription_reminder_three_days: boolean; subscription_reminder_one_day: boolean; subscription_reminder_due_day: boolean; subscription_overdue_reminders: boolean };
type ReminderEventType = 'bill' | 'subscription';
type StoredReminder = { notificationId: string; databaseNotificationId?: string; eventType: ReminderEventType; eventId: string; occurrenceDate: string; kind: ReminderKind; name: string; amount: number };
type PersistedReminder = { id: string; related_bill_id?: string | null; related_bill_occurrence_id?: string | null; related_subscription_id?: string | null; due_date?: string | null; reminder_kind?: string | null };

const defaults: ReminderPreferences = { bill_reminders: true, bill_reminder_days: 3, bill_reminder_three_days: true, bill_reminder_one_day: true, bill_reminder_due_day: true, bill_overdue_reminders: true, bill_reminder_hour: 9, bill_reminder_minute: 0, subscription_reminders: true, subscription_reminder_three_days: true, subscription_reminder_one_day: true, subscription_reminder_due_day: true, subscription_overdue_reminders: true };
const fallbackDelayMs = 5 * 60 * 1000;
let reconciliation: Promise<ReminderReconciliationResult> | null = null;
let accountCleanup: Promise<void> = Promise.resolve();

export type ReminderReconciliationResult = { permissionGranted: boolean; scheduled: number };

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

function logicalKey(eventType: ReminderEventType, eventId: string, occurrenceDate: string, kind: ReminderKind) { return `${eventType}:${eventId}:${occurrenceDate}:${kind}`; }
function dateAt(date: string, hour: number, minute: number) { const [year, month, day] = date.slice(0, 10).split('-').map(Number); return new Date(year, month - 1, day, hour, minute, 0, 0); }
function addDays(date: string, days: number) { const [year, month, day] = date.slice(0, 10).split('-').map(Number); const value = new Date(Date.UTC(year, month - 1, day + days)); return value.toISOString().slice(0, 10); }
function amount(value: number) { return `₱${Math.round(value).toLocaleString('en-PH')}`; }
function dueLabel(date: string) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(dateAt(date, 12, 0)); }

function logReminderFailure(operation: string, error: unknown) {
  if (__DEV__) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.warn(`[Financial reminders] ${operation} failed (${errorName}).`);
  }
}

async function userKey() {
  try {
    const user = (await getSupabaseClient()?.auth.getUser())?.data.user;
    return user?.id ? reminderStorageKey(user.id) : null;
  } catch (error) {
    logReminderFailure('resolve storage key', error);
    return null;
  }
}

async function readStored() {
  const key = await userKey();
  if (!key) return {} as Record<string, StoredReminder>;
  try {
    return JSON.parse((await SecureStore.getItemAsync(key)) || '{}') as Record<string, StoredReminder>;
  } catch (error) {
    logReminderFailure('read scheduled reminders', error);
    return {};
  }
}

async function writeStored(value: Record<string, StoredReminder>) {
  const key = await userKey();
  if (!key) return;
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
  } catch (error) {
    logReminderFailure('write scheduled reminders', error);
  }
}

export async function ensureReminderPermission() {
  try {
    // SecureStore records prompt policy only; the OS permission is always authoritative.
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
    if (!current.canAskAgain) return false;

    try {
      if ((await SecureStore.getItemAsync(SECURE_STORAGE_KEYS.reminderPermissionRequested)) === 'true') return false;
      await SecureStore.setItemAsync(SECURE_STORAGE_KEYS.reminderPermissionRequested, 'true');
    } catch (error) {
      logReminderFailure('read reminder prompt preference', error);
    }

    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch (error) {
    logReminderFailure('initialize notification permission', error);
    return false;
  }
}

async function ensureChannel() { if (Notifications.setNotificationChannelAsync) await Notifications.setNotificationChannelAsync('financial-reminders', { name: 'Financial reminders', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default', vibrationPattern: [0, 250, 250, 250] }); }
async function preferences() { try { return { ...defaults, ...(await authenticatedApiRequest<Partial<ReminderPreferences>>('/api/users/me/notification-preferences')) }; } catch { return defaults; } }

function candidates(item: FinanceItem, prefs: ReminderPreferences, now: Date) {
  const due = item.dueDate.slice(0, 10); const today = dateKeyInManila(now); const result: { kind: ReminderKind; trigger: Date }[] = [];
  const subscription = item.source === 'subscription';
  if (item.paid || (!subscription && !prefs.bill_reminders) || (subscription && !prefs.subscription_reminders)) return result;
  if (subscription ? prefs.subscription_reminder_three_days : prefs.bill_reminder_three_days) result.push({ kind: 'three_days_before', trigger: dateAt(addDays(due, -3), prefs.bill_reminder_hour, prefs.bill_reminder_minute) });
  if (subscription ? prefs.subscription_reminder_one_day : prefs.bill_reminder_one_day) result.push({ kind: 'one_day_before', trigger: dateAt(addDays(due, -1), prefs.bill_reminder_hour, prefs.bill_reminder_minute) });
  if (subscription ? prefs.subscription_reminder_due_day : prefs.bill_reminder_due_day) {
    const normal = dateAt(due, prefs.bill_reminder_hour, prefs.bill_reminder_minute);
    result.push({ kind: 'due_day', trigger: due === today && normal <= now ? new Date(now.getTime() + fallbackDelayMs) : normal });
  }
  if (subscription ? prefs.subscription_overdue_reminders : prefs.bill_overdue_reminders) {
    const overdueTrigger = dateAt(addDays(due, 1), prefs.bill_reminder_hour, prefs.bill_reminder_minute);
    result.push({ kind: 'overdue', trigger: overdueTrigger > now ? overdueTrigger : due < today ? new Date(now.getTime() + fallbackDelayMs) : overdueTrigger });
  }
  return result.filter((candidate) => candidate.trigger > now);
}

function copy(item: FinanceItem, kind: ReminderKind) { const renewal = item.source === 'subscription'; const verb = renewal ? 'renews' : 'is due'; const body = amount(item.amount) + (kind === 'three_days_before' ? ` · ${renewal ? 'Renews' : 'Due'} ${dueLabel(item.dueDate)}` : kind === 'overdue' ? ' · Tap to review' : ''); return { title: kind === 'three_days_before' ? `${item.name} ${verb} in 3 days` : kind === 'one_day_before' ? `${item.name} ${verb} tomorrow` : kind === 'overdue' ? `${item.name} ${renewal ? 'renewal is' : 'is'} overdue` : `${item.name} ${verb} today`, body }; }

async function cancelStored(record: StoredReminder) { try { await Notifications.cancelScheduledNotificationAsync(record.notificationId); } catch { /* stale OS IDs are harmless during reconciliation */ } }

async function reconcileFinancialRemindersInternal(items?: FinanceItem[]): Promise<ReminderReconciliationResult> {
  await accountCleanup;
  const prefs = await preferences(); const stored = await readStored();
  if (!prefs.bill_reminders && !prefs.subscription_reminders) { for (const record of Object.values(stored)) await cancelStored(record); await writeStored({}); return { permissionGranted: true, scheduled: 0 }; }
  if (!(await ensureReminderPermission())) return { permissionGranted: false, scheduled: 0 };
  await ensureChannel();
  // The database record is created before any OS notification is scheduled.
  // This gives the inbox and the system tray notification one stable identity.
  let persisted: PersistedReminder[] = [];
  try {
    const [bills, subscriptions] = await Promise.all([syncBillReminders(), syncSubscriptionReminders()]);
    persisted = [...bills.notifications, ...subscriptions.notifications];
  } catch (error) {
    logReminderFailure('persist financial reminders', error);
    return { permissionGranted: true, scheduled: 0 };
  }
  const persistedByKey = new Map(persisted.map((record) => {
    const eventType: ReminderEventType = record.related_subscription_id ? 'subscription' : 'bill';
    const eventId = record.related_subscription_id ?? record.related_bill_occurrence_id ?? record.related_bill_id;
    return [logicalKey(eventType, String(eventId), String(record.due_date).slice(0, 10), record.reminder_kind as ReminderKind), record];
  }));
  const current = new Map<string, StoredReminder>(); const now = new Date();
  for (const item of (items ?? await fetchFinanceItems()).filter((value) => value.source === 'bill' || value.source === 'subscription')) {
    const due = item.dueDate.slice(0, 10);
    for (const candidate of candidates(item, prefs, now)) {
      const key = logicalKey(item.source, item.id, due, candidate.kind); const existing = stored[key];
      if (existing && existing.databaseNotificationId && existing.name === item.name && existing.amount === item.amount) { current.set(key, existing); continue; }
      if (existing) await cancelStored(existing);
      const databaseNotification = persistedByKey.get(key);
      if (!databaseNotification) continue;
      const notificationId = await Notifications.scheduleNotificationAsync({ content: { ...copy(item, candidate.kind), data: { eventType: item.source, eventId: item.id, occurrenceDate: due, reminderKind: candidate.kind, notificationId: databaseNotification.id } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: candidate.trigger, channelId: 'financial-reminders' } });
      current.set(key, { notificationId, databaseNotificationId: databaseNotification.id, eventType: item.source, eventId: item.id, occurrenceDate: due, kind: candidate.kind, name: item.name, amount: item.amount });
    }
  }
  for (const [key, record] of Object.entries(stored)) if (!current.has(key)) await cancelStored(record);
  await writeStored(Object.fromEntries(current));
  return { permissionGranted: true, scheduled: current.size };
}

export async function reconcileFinancialReminders(items?: FinanceItem[]): Promise<ReminderReconciliationResult> {
  if (reconciliation) return reconciliation;
  reconciliation = reconcileFinancialRemindersInternal(items).catch((error) => {
    logReminderFailure('reconcile reminders', error);
    return { permissionGranted: false, scheduled: 0 };
  }).finally(() => { reconciliation = null; });
  return reconciliation;
}

export async function cancelBillReminders(eventId: string) { const stored = await readStored(); const remaining: Record<string, StoredReminder> = {}; for (const [key, record] of Object.entries(stored)) { if (record.eventId === eventId) await cancelStored(record); else remaining[key] = record; } await writeStored(remaining); }

/** OS scheduled notifications are process-global, so clear them on account changes. */
export function cancelAllFinancialReminders() {
  accountCleanup = (async () => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(scheduled.map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier),
      ));
    } catch (error) {
      logReminderFailure('cancel scheduled reminders during account change', error);
    }
  })();
  return accountCleanup;
}

export async function reconcileOnAppResume() { return reconcileFinancialReminders(); }

export const reminderDiagnostics = async () => ({ permission: await Notifications.getPermissionsAsync(), scheduled: await Notifications.getAllScheduledNotificationsAsync() });
