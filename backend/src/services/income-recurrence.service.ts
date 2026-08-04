type IncomeFrequency = "monthly" | "weekly" | "biweekly" | "yearly";
type IncomeRow = Record<string, any>;

function parseDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function frequencyOf(row: IncomeRow): IncomeFrequency {
  const frequency = String(row.frequency ?? "monthly").toLowerCase();
  return frequency === "weekly" || frequency === "biweekly" || frequency === "yearly" ? frequency : "monthly";
}

function isRecurring(row: IncomeRow) {
  return row.is_recurring === true || row.is_recurring === 1 || String(row.is_recurring).toLowerCase() === "true";
}

function occurrenceDates(row: IncomeRow, from: string, to: string) {
  const anchor = parseDate(String(row.date));
  const start = parseDate(from);
  const end = parseDate(to);
  const dates: string[] = [];
  const frequency = frequencyOf(row);

  if (frequency === "monthly") {
    const cursor = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    while (cursor <= end) {
      const candidate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), Math.min(anchor.getUTCDate(), daysInMonth(cursor.getUTCFullYear(), cursor.getUTCMonth()))));
      if (candidate > anchor && candidate >= start && candidate <= end) dates.push(dateKey(candidate));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    }
    return dates;
  }

  if (frequency === "yearly") {
    const cursor = new Date(anchor);
    while (cursor <= end) {
      const candidate = new Date(Date.UTC(cursor.getUTCFullYear(), anchor.getUTCMonth(), Math.min(anchor.getUTCDate(), daysInMonth(cursor.getUTCFullYear(), anchor.getUTCMonth()))));
      if (candidate > anchor && candidate >= start && candidate <= end) dates.push(dateKey(candidate));
      cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
    }
    return dates;
  }

  const cursor = new Date(anchor);
  const step = frequency === "biweekly" ? 14 : 7;
  cursor.setUTCDate(cursor.getUTCDate() + step);
  while (cursor <= end) {
    if (cursor >= start) dates.push(dateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + step);
  }
  return dates;
}

export function expandIncomeRows(rows: IncomeRow[], from: string, to: string): IncomeRow[] {
  const actualRows = rows.filter((row) => String(row.date) >= from && String(row.date) <= to);
  const actualKeys = new Set(rows.map((row) => `${row.source}|${Number(row.amount)}|${row.date}`));
  const scheduled: IncomeRow[] = [];

  rows.filter(isRecurring).forEach((row) => {
    occurrenceDates(row, from, to).forEach((date) => {
      const key = `${row.source}|${Number(row.amount)}|${date}`;
      if (actualKeys.has(key)) return;
      scheduled.push({ ...row, id: `scheduled-${row.id}-${date}`, date, is_scheduled: true, recurrence_key: `${row.id}:${date}` });
    });
  });

  return [...actualRows, ...scheduled].sort((left, right) => String(right.date).localeCompare(String(left.date)));
}
