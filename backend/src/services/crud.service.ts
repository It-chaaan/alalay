import { client, requireUserId, throwIfError, type TableName } from "./db.js";
import { AppError } from "../utils/api.js";

export async function listOwned(table: TableName, userId: string, filters?: Record<string, unknown>) {
  let query = client().from(table).select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null).order("created_at", { ascending: false });

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        query = query.eq(key, value);
      }
    }
  }

  const { data, error } = await query;
  throwIfError(error);
  return data ?? [];
}

export async function getOwned(table: TableName, userId: string, id: string) {
  const { data, error } = await client().from(table).select("*").eq("user_id", requireUserId(userId)).eq("id", id).is("deleted_at", null).single();
  if (error) {
    throw new AppError(404, "not_found", "Record not found.");
  }
  return data;
}

export async function createOwned(table: TableName, userId: string, payload: Record<string, unknown>) {
  const { data, error } = await client().from(table).insert({ ...payload, user_id: requireUserId(userId) }).select("*").single();
  throwIfError(error);
  return data;
}

export async function updateOwned(table: TableName, userId: string, id: string, payload: Record<string, unknown>) {
  const { data, error } = await client().from(table).update(payload).eq("user_id", requireUserId(userId)).eq("id", id).is("deleted_at", null).select("*").single();
  if (error) {
    throw new AppError(404, "not_found", "Record not found.");
  }
  return data;
}

export async function softDeleteOwned(table: TableName, userId: string, id: string) {
  const { data, error } = await client().from(table).update({ deleted_at: new Date().toISOString() }).eq("user_id", requireUserId(userId)).eq("id", id).is("deleted_at", null).select("id, deleted_at").single();
  if (error) {
    throw new AppError(404, "not_found", "Record not found.");
  }
  return data;
}
