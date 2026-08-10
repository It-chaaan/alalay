import { client, requireUserId, throwIfError } from "./db.js";

export async function getProfile(userId: string) {
  const { data, error } = await client().from("users").select("*").eq("id", requireUserId(userId)).is("deleted_at", null).single();
  throwIfError(error);
  return data;
}

export async function updateProfile(userId: string, payload: Record<string, unknown>) {
  // Auth email is controlled by Supabase Auth. Keep the public profile email
  // out of this generic profile mutation so the two identities cannot drift.
  const editableFields = ["name", "avatar_url", "phone", "currency", "language", "income", "pay_schedule", "onboarding_done"];
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

const defaultOverviewPreferences = {
  cards: ["bills", "spending", "savings"],
};

export async function getOverviewPreferences(userId: string) {
  const id = requireUserId(userId);
  const { data, error } = await client().from("dashboard_preferences").select("user_id,overview_cards").eq("user_id", id).maybeSingle();
  throwIfError(error);
  if (data) return { user_id: data.user_id, cards: data.overview_cards };

  const { data: created, error: createError } = await client()
    .from("dashboard_preferences")
    .insert({ user_id: id, overview_cards: defaultOverviewPreferences.cards })
    .select("user_id,overview_cards")
    .single();
  throwIfError(createError);
  if (!created) throw new Error("Dashboard preferences could not be created.");
  return { user_id: created.user_id, cards: created.overview_cards };
}

export async function updateOverviewPreferences(userId: string, payload: Record<string, unknown>) {
  const id = requireUserId(userId);
  const cards = payload.cards as string[];
  const { data, error } = await client()
    .from("dashboard_preferences")
    .upsert({ user_id: id, overview_cards: cards }, { onConflict: "user_id" })
    .select("user_id,overview_cards")
    .single();
  throwIfError(error);
  if (!data) throw new Error("Dashboard preferences could not be saved.");
  return { user_id: data.user_id, cards: data.overview_cards };
}
