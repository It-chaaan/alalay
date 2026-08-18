import type { IncomeEntry } from "../hooks/types";

export type IncomeFrequency = "monthly" | "weekly" | "biweekly" | "yearly";
export type IncomeOccurrence = IncomeEntry & { is_scheduled?: boolean; recurrence_key?: string };

function parseDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function frequencyOf(entry: IncomeEntry): IncomeFrequency | null {
  const frequency = String(entry.frequency ?? "").toLowerCase();
  return frequency === "weekly" || frequency === "biweekly" || frequency === "yearly" || frequency === "monthly"
    ? frequency
    : null;
}

export function isIncomeRecurring(entry: Pick<IncomeEntry, "is_recurring">) {
  const value = entry.is_recurring as unknown;
  return value === true || value === 1 || String(value).toLowerCase() === "true";
}

/** Formats recurrence for compact income-source summaries without inventing a frequency. */
export function formatIncomeRecurrence(entry: Pick<IncomeEntry, "is_recurring" | "frequency">) {
  if (!isIncomeRecurring(entry)) return null;
  switch (entry.frequency) {
    case "weekly": return "/week";
    case "biweekly": return "/2 weeks";
    case "monthly": return "/mo";
    case "yearly": return "/year";
    default: return "Recurring";
  }
}

function occurrenceDates(entry: IncomeEntry, from: string, to: string) {
  const anchor = parseDate(entry.date);
  const start = parseDate(from);
  const end = parseDate(to);
  const dates: string[] = [];
  const frequency = frequencyOf(entry);
  if (!frequency) return dates;

  if (frequency === "monthly") {
    const cursor = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    while (cursor <= end) {
      const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(anchor.getDate(), daysInMonth(cursor.getFullYear(), cursor.getMonth())));
      if (candidate > anchor && candidate >= start && candidate <= end) dates.push(toDateKey(candidate));
      cursor.setMonth(cursor.getMonth() + 1, 1);
    }
    return dates;
  }

  if (frequency === "yearly") {
    const cursor = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    while (cursor <= end) {
      const candidate = new Date(cursor.getFullYear(), anchor.getMonth(), Math.min(anchor.getDate(), daysInMonth(cursor.getFullYear(), anchor.getMonth())));
      if (candidate > anchor && candidate >= start && candidate <= end) dates.push(toDateKey(candidate));
      cursor.setFullYear(cursor.getFullYear() + 1);
    }
    return dates;
  }

  const step = frequency === "biweekly" ? 14 : 7;
  const cursor = new Date(anchor);
  cursor.setDate(cursor.getDate() + step);
  while (cursor <= end) {
    if (cursor >= start) dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + step);
  }
  return dates;
}

export function buildIncomeOccurrences(entries: IncomeEntry[], from: string, to: string): IncomeOccurrence[] {
  const actualKeys = new Set(entries.map((entry) => `${entry.source}|${Number(entry.amount)}|${entry.date}`));
  const scheduled: IncomeOccurrence[] = [];

  entries.filter(isIncomeRecurring).forEach((entry) => {
    occurrenceDates(entry, from, to).forEach((date) => {
      const actualKey = `${entry.source}|${Number(entry.amount)}|${date}`;
      if (actualKeys.has(actualKey)) return;
      scheduled.push({
        ...entry,
        id: `scheduled-${entry.id}-${date}`,
        date,
        is_scheduled: true,
        recurrence_key: `${entry.id}:${date}`,
      });
    });
  });

  return [...entries, ...scheduled].sort((left, right) => right.date.localeCompare(left.date));
}
