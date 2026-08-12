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
};

export async function createInAppNotification(input: { userId: string; type: string; title: string; body: string; related_bill_id?: string | null; related_subscription_id?: string | null; related_wallet_id?: string | null; period_key?: string | null }) {
  const { userId, ...notification } = input;
  const { data, error } = await client().from("notifications").upsert({ user_id: requireUserId(userId), ...notification }, { onConflict: "user_id,type,related_bill_id,related_subscription_id,related_wallet_id,period_key", ignoreDuplicates: true }).select("id, type, title, body, read_at, created_at, related_bill_id, related_subscription_id, related_wallet_id").maybeSingle();
  throwIfError(error);
  return data as InAppNotification | null;
}

export async function listNotifications(userId: string) {
  const { data, error } = await client().from("notifications").select("id, type, title, body, read_at, created_at, related_bill_id, related_subscription_id, related_wallet_id").eq("user_id", requireUserId(userId)).order("created_at", { ascending: false }).limit(100);
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
