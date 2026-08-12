import { authenticatedApiRequest } from './api';

export type InAppNotification = { id: string; type: string; title: string; body: string; read_at: string | null; created_at: string; related_bill_id?: string | null; related_subscription_id?: string | null; related_wallet_id?: string | null };

export function fetchNotifications() {
  return authenticatedApiRequest<InAppNotification[]>('/api/notifications');
}

export async function getUnreadNotificationCount() {
  const result = await authenticatedApiRequest<{ count: number }>('/api/notifications/unread-count');
  return Number.isFinite(result.count) ? result.count : 0;
}

export function markNotificationsRead() {
  return authenticatedApiRequest<{ success: boolean }>('/api/notifications/read', { method: 'POST' });
}
