import { client, monthRange, requireUserId, throwIfError, todayIso } from "./db.js";
import { expandIncomeRows } from "./income-recurrence.service.js";

export type IncomeSummaryRange = {
  rows: Array<Record<string, any>>;
  actualRows: Array<Record<string, any>>;
  scheduledRows: Array<Record<string, any>>;
  total: number;
  actualTotal: number;
  scheduledTotal: number;
};

async function allIncomeRows(userId: string, from?: string, to?: string) {
  let query = client()
    .from("income")
    .select("*")
    .eq("user_id", requireUserId(userId))
    .is("deleted_at", null)
    .order("date", { ascending: false });
  if (from && to) query = query.or(`date.gte.${from},is_recurring.eq.true`).lte("date", to);
  const { data, error } = await query;
  throwIfError(error);
  return data ?? [];
}

function summarize(rows: Array<Record<string, any>>): IncomeSummaryRange {
  const actualRows = rows.filter((row) => !row.is_scheduled);
  const scheduledRows = rows.filter((row) => Boolean(row.is_scheduled));
  const actualTotal = actualRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const scheduledTotal = scheduledRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return {
    rows,
    actualRows,
    scheduledRows,
    total: actualTotal + scheduledTotal,
    actualTotal,
    scheduledTotal,
  };
}

/** Single source of truth for income in any selected date range. */
export async function incomeForRange(userId: string, from: string, to: string) {
  const rows = await allIncomeRows(userId, from, to);
  return summarize(expandIncomeRows(rows, from, to));
}

/** Single source of truth for the selected calendar month. */
export async function incomeForMonth(userId: string, month?: string) {
  const selectedMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : todayIso().slice(0, 7);
  const [year, monthNumber] = selectedMonth.split("-").map(Number);
  const range = monthRange(new Date(year, monthNumber - 1, 1));
  const current = await incomeForRange(userId, range.start, range.end);
  const ytd = await incomeForRange(userId, `${year}-01-01`, range.end);
  const actualYtd = ytd.actualTotal;

  return {
    ...current,
    month: selectedMonth,
    this_month: current.total,
    ytd: actualYtd,
    average_month: actualYtd / Math.max(1, monthNumber),
    sources: new Set(current.rows.map((row) => row.source)).size,
  };
}
