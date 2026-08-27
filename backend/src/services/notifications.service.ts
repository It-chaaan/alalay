import { client, requireUserId, throwIfError } from "./db.js";

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
};

export const NOTIFICATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function notificationCutoff(now = new Date()) {
  return new Date(now.getTime() - NOTIFICATION_WINDOW_MS).toISOString();
}

export async function createInAppNotification(input: { userId: string; type: string; title: string; body: string; related_bill_id?: string | null; related_subscription_id?: string | null; related_wallet_id?: string | null; period_key?: string | null; source_type?: string | null; source_id?: string | null; deduplication_key?: string | null; action?: { route?: string; params?: Record<string, string> } | null }) {
  const { userId, ...notification } = input;
  const { data, error } = await client().from("notifications").upsert({ user_id: requireUserId(userId), ...notification }, { onConflict: "user_id,deduplication_key", ignoreDuplicates: true }).select("id, type, title, body, read_at, created_at, related_bill_id, related_subscription_id, related_wallet_id, source_type, source_id, action").maybeSingle();
  throwIfError(error);
  return data as InAppNotification | null;
}

export async function listNotifications(userId: string) {
  const now = new Date();
  const { data, error } = await client().from("notifications").select("id, type, title, body, read_at, created_at, related_bill_id, related_subscription_id, related_wallet_id, source_type, source_id, action").eq("user_id", requireUserId(userId)).gte("created_at", notificationCutoff(now)).lte("created_at", now.toISOString()).order("created_at", { ascending: false }).limit(100);
  throwIfError(error);
  return (data ?? []) as InAppNotification[];
}

export async function unreadNotificationCount(userId: string) {
  const now = new Date();
  const { count, error } = await client().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", requireUserId(userId)).gte("created_at", notificationCutoff(now)).lte("created_at", now.toISOString()).is("read_at", null);
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
