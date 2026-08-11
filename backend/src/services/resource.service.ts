import { client, requireUserId, throwIfError, type TableName } from "./db.js";
import { createOwned, getOwned, listOwned, softDeleteOwned, updateOwned } from "./crud.service.js";
import { AppError } from "../utils/api.js";

export function makeResourceService(table: TableName) {
  return {
    list: (userId: string, filters?: Record<string, unknown>) => listOwned(table, userId, filters),
    get: (userId: string, id: string) => getOwned(table, userId, id),
    create: (userId: string, payload: Record<string, unknown>) => createOwned(table, userId, payload),
    update: async (userId: string, id: string, payload: Record<string, unknown>) => {
      if (table === "subscriptions") {
        const { data: current, error } = await client().from("subscriptions").select("auto_renew, wallet_id").eq("id", id).eq("user_id", requireUserId(userId)).is("deleted_at", null).maybeSingle();
        throwIfError(error);
        const active = payload.auto_renew !== false && current?.auto_renew !== false;
        const walletId = payload.wallet_id === undefined ? current?.wallet_id : payload.wallet_id;
        if (active && !walletId) throw new AppError(400, "validation_error", "Choose a payment wallet for this active subscription.");
      }
      return updateOwned(table, userId, id, payload);
    },
    remove: (userId: string, id: string) => softDeleteOwned(table, userId, id),
  };
}

export async function listByDateRange(table: TableName, userId: string, dateColumn: string, from?: string, to?: string) {
  let query = client().from(table).select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null).order(dateColumn, { ascending: false });
  if (from) query = query.gte(dateColumn, from);
  if (to) query = query.lte(dateColumn, to);
  const { data, error } = await query;
  throwIfError(error);
  return data ?? [];
}
