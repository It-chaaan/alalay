import { client, requireUserId, throwIfError } from "./db.js";

export async function getProfile(userId: string) {
  const { data, error } = await client().from("users").select("*").eq("id", requireUserId(userId)).is("deleted_at", null).single();
  throwIfError(error);
  return data;
}

export async function updateProfile(userId: string, payload: Record<string, unknown>) {
  const editableFields = ["name", "email", "avatar_url", "phone", "currency", "language", "income", "pay_schedule", "onboarding_done"];
  const safePayload = Object.fromEntries(Object.entries(payload).filter(([key]) => editableFields.includes(key)));
  const { data, error } = await client().from("users").update(safePayload).eq("id", requireUserId(userId)).select("*").single();
  throwIfError(error);
  return data;
}

const defaultNotificationPreferences = {
  bill_reminders: true,
  bill_reminder_days: 3,
  subscription_reminders: true,
  summaries: false,
  overspending_alerts: true,
  budget_thresholds: true,
  savings_milestones: true,
  login_alerts: true,
};

export async function getNotificationPreferences(userId: string) {
  const id = requireUserId(userId);
  const { data, error } = await client().from("notification_preferences").select("*").eq("user_id", id).maybeSingle();
  throwIfError(error);
  if (data) return data;

  const { data: created, error: createError } = await client()
    .from("notification_preferences")
    .insert({ user_id: id, ...defaultNotificationPreferences })
    .select("*")
    .single();
  throwIfError(createError);
  return created;
}

export async function updateNotificationPreferences(userId: string, payload: Record<string, unknown>) {
  const id = requireUserId(userId);
  const { data, error } = await client()
    .from("notification_preferences")
    .upsert({ user_id: id, ...payload }, { onConflict: "user_id" })
    .select("*")
    .single();
  throwIfError(error);
  return data;
}
