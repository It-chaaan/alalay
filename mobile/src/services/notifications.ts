import { authenticatedApiRequest } from './api';
import { createRequestGate } from '@/utils/request-gate';

export type InAppNotification = { id: string; type: string; title: string; body: string; read_at: string | null; created_at: string; related_bill_id?: string | null; related_bill_occurrence_id?: string | null; related_subscription_id?: string | null; related_wallet_id?: string | null; source_type?: string | null; source_id?: string | null; reminder_kind?: string | null; due_date?: string | null; amount?: number | null; action?: { route?: string; params?: Record<string, string> } | null };
export type BillReminderSync = { notifications: InAppNotification[]; eligible: number; created: number; skippedExisting: number; invalid: number; failed: number };
const unreadCountRequest = createRequestGate<number>();

export function fetchNotifications() {
  return authenticatedApiRequest<InAppNotification[]>('/api/notifications');
}

export async function getUnreadNotificationCount() {
  return unreadCountRequest(async () => {
    const result = await authenticatedApiRequest<{ count: number }>('/api/notifications/unread-count');
    return Number.isFinite(result.count) ? result.count : 0;
  });
}

export function markNotificationsRead() {
  return authenticatedApiRequest<{ success: boolean }>('/api/notifications/read', { method: 'POST' });
}

export function markNotificationRead(id: string) {
  return authenticatedApiRequest<{ success: boolean }>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export function syncBillReminders() {
  return authenticatedApiRequest<BillReminderSync>('/api/notifications/sync-bill-reminders', { method: 'POST' });
}
