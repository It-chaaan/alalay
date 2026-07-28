import { getSupabase } from "../config/supabase.js";
import { AppError } from "../utils/api.js";

export type TableName = "bills" | "expenses" | "income" | "subscriptions" | "savings_goals";

export function asNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value || 0);
}

export function requireUserId(userId: string | undefined) {
  if (!userId) {
    throw new AppError(401, "unauthorized", "Authentication is required.");
  }
  return userId;
}

export function todayIso() {
  return toDateOnlyIso(new Date());
}

export function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateOnlyIso(date);
}

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: toDateOnlyIso(start),
    end: toDateOnlyIso(end),
  };
}

export function previousMonthRange(date = new Date()) {
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return monthRange(previous);
}

export function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new AppError(500, "database_error", error.message);
  }
}

function toDateOnlyIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function client() {
  return getSupabase();
}
