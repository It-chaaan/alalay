import { getSupabase } from "../config/supabase.js";
import { AppError } from "../utils/api.js";

export type TableName = "bills" | "expenses" | "income" | "subscriptions" | "savings_goals";

export function asNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));

    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value || 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function requireUserId(userId: string | undefined) {
  if (!userId) {
    throw new AppError(401, "unauthorized", "Authentication is required.");
  }
  return userId;
}

const appTimeZone = "Asia/Manila";

function zonedDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: appTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

export function todayIso(date = new Date()) {
  const parts = zonedDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateOnlyIso(date);
}

export function monthRange(date = new Date()) {
  const parts = zonedDateParts(date);
  const start = `${parts.year}-${String(parts.month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  const end = `${parts.year}-${String(parts.month).padStart(2, "0")}-${daysInMonth}`;
  return {
    start,
    end,
  };
}

export function previousMonthRange(date = new Date()) {
  const parts = zonedDateParts(date);
  const previous = new Date(Date.UTC(parts.year, parts.month - 2, 1, 12));
  return monthRange(previous);
}

export function throwIfError(error: { message: string; code?: string; details?: string } | null) {
  if (error) {
    const code = error.code ?? "unknown";
    if (code === "23505") throw new AppError(409, "database_conflict", "This record already exists.", `${code}: ${error.message}`);
    if (code === "23514" && error.message.includes("income_type_check")) {
      throw new AppError(400, "invalid_income_category", "Select an income category.", `${code}: ${error.message}`);
    }
    if (code === "23503" && error.message.includes("income_wallet_id_fkey")) {
      throw new AppError(400, "invalid_wallet", "Select where this income was received.", `${code}: ${error.message}`);
    }
    if (code === "23503" || code === "23514" || code.startsWith("22")) throw new AppError(400, "database_validation", "The submitted information could not be saved.", `${code}: ${error.message}${error.details ? ` (${error.details})` : ""}`);
    throw new AppError(500, "database_error", "The database operation could not be completed.", `${code}: ${error.message}${error.details ? ` (${error.details})` : ""}`);
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
