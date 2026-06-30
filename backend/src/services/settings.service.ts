import { client, requireUserId, throwIfError } from "./db.js";

export async function getProfile(userId: string) {
  const { data, error } = await client().from("users").select("*").eq("id", requireUserId(userId)).is("deleted_at", null).single();
  throwIfError(error);
  return data;
}

export async function updateProfile(userId: string, payload: Record<string, unknown>) {
  const { data, error } = await client().from("users").update(payload).eq("id", requireUserId(userId)).select("*").single();
  throwIfError(error);
  return data;
}
