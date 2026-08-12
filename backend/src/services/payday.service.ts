import { client, requireUserId, throwIfError, todayIso, asNumber } from "./db.js";
import { isRecurring, nextOccurrenceDate, type IncomeRow } from "./income-recurrence.service.js";

export type Payday = { date: string; amount: number; source: string };

function isSalary(row: IncomeRow) {
  return String(row.type ?? "").trim().toLowerCase() === "salary" || /payroll/i.test(String(row.source ?? ""));
}

/**
 * Payday semantics: prefer a recurring income whose source or type identifies
 * it as salary/payroll. Otherwise choose the earliest next occurrence, with a
 * stable id tie-breaker so database ordering never changes the result.
 */
export async function nextPayday(userId: string, from = todayIso()): Promise<Payday | null> {
  const { data, error } = await client().from("income")
    .select("id, source, type, amount, date, is_recurring, frequency")
    .eq("user_id", requireUserId(userId)).is("deleted_at", null);
  throwIfError(error);

  const candidates = (data ?? []).filter(isRecurring).map((row) => ({
    row: row as IncomeRow,
    date: nextOccurrenceDate(row as IncomeRow, from),
  })).filter((item): item is { row: IncomeRow; date: string } => Boolean(item.date));
  if (!candidates.length) return null;

  const salaryCandidates = candidates.filter(({ row }) => isSalary(row));
  const eligible = salaryCandidates.length ? salaryCandidates : candidates;
  eligible.sort((left, right) => left.date.localeCompare(right.date) || String(left.row.id).localeCompare(String(right.row.id)));
  const selected = eligible[0].row;
  return { date: eligible[0].date, amount: asNumber(selected.amount), source: String(selected.source ?? "Income") };
}
