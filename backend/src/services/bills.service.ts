import { addDaysIso, client, requireUserId, throwIfError, todayIso } from "./db.js";
import { createOwned, getOwned, listOwned, softDeleteOwned, updateOwned } from "./crud.service.js";
import { AppError } from "../utils/api.js";

export async function listBills(userId: string, query: { status?: string; due_within_days?: number; category?: string }) {
  let request = client().from("bills").select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null).order("due_date", { ascending: true });
  if (query.status) request = request.eq("status", query.status);
  if (query.category) request = request.eq("category", query.category);
  if (query.due_within_days !== undefined) request = request.gte("due_date", todayIso()).lte("due_date", addDaysIso(query.due_within_days));
  const { data, error } = await request;
  throwIfError(error);
  return data ?? [];
}

export const getBill = (userId: string, id: string) => getOwned("bills", userId, id);
export const createBill = (userId: string, payload: Record<string, unknown>) => createOwned("bills", userId, payload);
export const updateBill = (userId: string, id: string, payload: Record<string, unknown>) => updateOwned("bills", userId, id, payload);
export const deleteBill = (userId: string, id: string) => softDeleteOwned("bills", userId, id);

export async function payBill(userId: string, id: string) {
  const { data, error } = await client().from("bills").update({ status: "paid", paid_at: new Date().toISOString() }).eq("user_id", requireUserId(userId)).eq("id", id).is("deleted_at", null).select("*").single();
  if (error) {
    throw new AppError(404, "not_found", "Bill not found.");
  }
  return data;
}

export async function billSummary(userId: string) {
  const rows = await listOwned("bills", userId);
  const unpaid = rows.filter((row) => row.status !== "paid");
  return {
    total_unpaid: unpaid.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    due_this_week: unpaid.filter((row) => row.due_date >= todayIso() && row.due_date <= addDaysIso(7)).reduce((sum, row) => sum + Number(row.amount || 0), 0),
    overdue: unpaid.filter((row) => row.status === "overdue" || row.due_date < todayIso()).reduce((sum, row) => sum + Number(row.amount || 0), 0),
    items: rows,
  };
}
