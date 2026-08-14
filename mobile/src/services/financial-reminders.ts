import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { authenticatedApiRequest } from './api';
import { dateKeyInManila, fetchFinanceItems, type FinanceItem } from './finance';
import { getSupabaseClient } from './supabase';

export type ReminderKind = 'three_days_before' | 'one_day_before' | 'due_day' | 'overdue';
type ReminderPreferences = { bill_reminders: boolean; bill_reminder_days: number; bill_reminder_three_days: boolean; bill_reminder_one_day: boolean; bill_reminder_due_day: boolean; bill_overdue_reminders: boolean; bill_reminder_hour: number; bill_reminder_minute: number };
type StoredReminder = { notificationId: string; eventType: 'bill'; eventId: string; occurrenceDate: string; kind: ReminderKind; name: string; amount: number };

const defaults: ReminderPreferences = { bill_reminders: true, bill_reminder_days: 3, bill_reminder_three_days: true, bill_reminder_one_day: true, bill_reminder_due_day: true, bill_overdue_reminders: true, bill_reminder_hour: 9, bill_reminder_minute: 0 };
const storePrefix = 'alalay-financial-reminders:';
const fallbackDelayMs = 5 * 60 * 1000;

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

function logicalKey(eventId: string, occurrenceDate: string, kind: ReminderKind) { return `bill:${eventId}:${occurrenceDate}:${kind}`; }
function dateAt(date: string, hour: number, minute: number) { const [year, month, day] = date.slice(0, 10).split('-').map(Number); return new Date(year, month - 1, day, hour, minute, 0, 0); }
function addDays(date: string, days: number) { const [year, month, day] = date.slice(0, 10).split('-').map(Number); const value = new Date(Date.UTC(year, month - 1, day + days)); return value.toISOString().slice(0, 10); }
function amount(value: number) { return `₱${Math.round(value).toLocaleString('en-PH')}`; }
function dueLabel(date: string) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(dateAt(date, 12, 0)); }

async function userKey() { const user = (await getSupabaseClient()?.auth.getUser())?.data.user; return user?.id ? `${storePrefix}${user.id}` : null; }
async function permissionKey() { const key = await userKey(); return key ? `${key}:permission-requested` : null; }
async function readStored() { const key = await userKey(); if (!key) return {} as Record<string, StoredReminder>; try { return JSON.parse((await SecureStore.getItemAsync(key)) || '{}') as Record<string, StoredReminder>; } catch { return {}; } }
async function writeStored(value: Record<string, StoredReminder>) { const key = await userKey(); if (key) await SecureStore.setItemAsync(key, JSON.stringify(value)); }

export async function ensureReminderPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
  if (!current.canAskAgain) return false;
  const promptedKey = await permissionKey();
  if (promptedKey && (await SecureStore.getItemAsync(promptedKey)) === 'true') return false;
  if (promptedKey) await SecureStore.setItemAsync(promptedKey, 'true');
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function ensureChannel() { if (Notifications.setNotificationChannelAsync) await Notifications.setNotificationChannelAsync('financial-reminders', { name: 'Financial reminders', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default', vibrationPattern: [0, 250, 250, 250] }); }
async function preferences() { try { return { ...defaults, ...(await authenticatedApiRequest<Partial<ReminderPreferences>>('/api/users/me/notification-preferences')) }; } catch { return defaults; } }

function candidates(item: FinanceItem, prefs: ReminderPreferences, now: Date) {
  const due = item.dueDate.slice(0, 10); const today = dateKeyInManila(now); const result: Array<{ kind: ReminderKind; trigger: Date }> = [];
  if (item.paid || !prefs.bill_reminders) return result;
  if (prefs.bill_reminder_three_days) result.push({ kind: 'three_days_before', trigger: dateAt(addDays(due, -3), prefs.bill_reminder_hour, prefs.bill_reminder_minute) });
  if (prefs.bill_reminder_one_day) result.push({ kind: 'one_day_before', trigger: dateAt(addDays(due, -1), prefs.bill_reminder_hour, prefs.bill_reminder_minute) });
  if (prefs.bill_reminder_due_day) {
    const normal = dateAt(due, prefs.bill_reminder_hour, prefs.bill_reminder_minute);
    result.push({ kind: 'due_day', trigger: due === today && normal <= now ? new Date(now.getTime() + fallbackDelayMs) : normal });
  }
  if (prefs.bill_overdue_reminders) {
    const overdueTrigger = dateAt(addDays(due, 1), prefs.bill_reminder_hour, prefs.bill_reminder_minute);
    result.push({ kind: 'overdue', trigger: overdueTrigger > now ? overdueTrigger : due < today ? new Date(now.getTime() + fallbackDelayMs) : overdueTrigger });
  }
  return result.filter((candidate) => candidate.trigger > now);
}

function copy(item: FinanceItem, kind: ReminderKind) { const body = amount(item.amount) + (kind === 'three_days_before' ? ` · Due ${dueLabel(item.dueDate)}` : kind === 'overdue' ? ' · Tap to review' : ''); return { title: kind === 'three_days_before' ? `${item.name} is due in 3 days` : kind === 'one_day_before' ? `${item.name} is due tomorrow` : kind === 'overdue' ? `${item.name} is overdue` : `${item.name} is due today`, body }; }

async function cancelStored(record: StoredReminder) { try { await Notifications.cancelScheduledNotificationAsync(record.notificationId); } catch { /* stale OS IDs are harmless during reconciliation */ } }

export async function reconcileFinancialReminders(items?: FinanceItem[]) {
  const prefs = await preferences(); const stored = await readStored();
  if (!prefs.bill_reminders) { for (const record of Object.values(stored)) await cancelStored(record); await writeStored({}); return { permissionGranted: true, scheduled: 0 }; }
  if (!(await ensureReminderPermission())) return { permissionGranted: false, scheduled: 0 };
  await ensureChannel();
  const current = new Map<string, StoredReminder>(); const now = new Date();
  for (const item of (items ?? await fetchFinanceItems()).filter((value) => value.source === 'bill')) {
    const due = item.dueDate.slice(0, 10);
    for (const candidate of candidates(item, prefs, now)) {
      const key = logicalKey(item.id, due, candidate.kind); const existing = stored[key];
      if (existing && existing.name === item.name && existing.amount === item.amount) { current.set(key, existing); continue; }
      if (existing) await cancelStored(existing);
      const notificationId = await Notifications.scheduleNotificationAsync({ content: { ...copy(item, candidate.kind), data: { eventType: 'bill', eventId: item.id, occurrenceDate: due, reminderKind: candidate.kind } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: candidate.trigger, channelId: 'financial-reminders' } });
      current.set(key, { notificationId, eventType: 'bill', eventId: item.id, occurrenceDate: due, kind: candidate.kind, name: item.name, amount: item.amount });
    }
  }
  for (const [key, record] of Object.entries(stored)) if (!current.has(key)) await cancelStored(record);
  await writeStored(Object.fromEntries(current));
  return { permissionGranted: true, scheduled: current.size };
}

export async function cancelBillReminders(eventId: string) { const stored = await readStored(); const remaining: Record<string, StoredReminder> = {}; for (const [key, record] of Object.entries(stored)) { if (record.eventId === eventId) await cancelStored(record); else remaining[key] = record; } await writeStored(remaining); }

export async function reconcileOnAppResume() { return reconcileFinancialReminders(); }

export const reminderDiagnostics = async () => ({ permission: await Notifications.getPermissionsAsync(), scheduled: await Notifications.getAllScheduledNotificationsAsync() });
