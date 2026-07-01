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
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
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

export function client() {
  return getSupabase();
}
