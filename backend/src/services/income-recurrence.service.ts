type IncomeFrequency = 'monthly' | 'weekly' | 'biweekly' | 'yearly';
export type IncomeRow = Record<string, any>;

function parseDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function frequencyOf(row: IncomeRow): IncomeFrequency | null {
  const frequency = String(row.frequency ?? '').toLowerCase();
  return frequency === 'weekly' ||
    frequency === 'biweekly' ||
    frequency === 'yearly' ||
    frequency === 'monthly'
    ? frequency
    : null;
}

export function isRecurring(row: IncomeRow) {
  return (
    row.is_recurring === true ||
    row.is_recurring === 1 ||
    String(row.is_recurring).toLowerCase() === 'true'
  );
}

export function nextOccurrenceDate(row: IncomeRow, from: string) {
  const dates = occurrenceDates(row, from, addDays(from, 400));
  return dates[0] ?? null;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + days);
  return dateKey(value);
}

function occurrenceDates(row: IncomeRow, from: string, to: string) {
  // `date` is the mutable next-due date of an active schedule. Historical
  // month views must instead use the immutable schedule anchor when present.
  const anchor = parseDate(String(row.schedule_anchor_date ?? row.date));
  const start = parseDate(from);
  const end = parseDate(to);
  const dates: string[] = [];
  const frequency = frequencyOf(row);
  if (!frequency) return dates;

  if (frequency === 'monthly') {
    const cursor = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    while (cursor <= end) {
      const candidate = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          Math.min(anchor.getUTCDate(), daysInMonth(cursor.getUTCFullYear(), cursor.getUTCMonth())),
        ),
      );
      if (candidate >= anchor && candidate >= start && candidate <= end)
        dates.push(dateKey(candidate));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    }
    return dates;
  }

  if (frequency === 'yearly') {
    const cursor = new Date(anchor);
    while (cursor <= end) {
      const candidate = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          anchor.getUTCMonth(),
          Math.min(anchor.getUTCDate(), daysInMonth(cursor.getUTCFullYear(), anchor.getUTCMonth())),
        ),
      );
      if (candidate >= anchor && candidate >= start && candidate <= end)
        dates.push(dateKey(candidate));
      cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
    }
    return dates;
  }

  const cursor = new Date(anchor);
  const step = frequency === 'biweekly' ? 14 : 7;
  while (cursor <= end) {
    if (cursor >= start) dates.push(dateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + step);
  }
  return dates;
}

export function isRecurringApplicableInRange(row: IncomeRow, from: string, to: string) {
  return occurrenceDates(row, from, to).length > 0;
}

export function expandIncomeRows(rows: IncomeRow[], from: string, to: string): IncomeRow[] {
  const actualRows = rows.filter(
    (row) => row.is_posted !== false && String(row.date) >= from && String(row.date) <= to,
  );
  const scheduled: IncomeRow[] = [];

  rows
    .filter(
      (row) => row.is_posted === false && row.schedule_status === 'active' && !isRecurring(row),
    )
    .filter((row) => String(row.date) >= from && String(row.date) <= to)
    .forEach((row) =>
      scheduled.push({
        ...row,
        id: `scheduled-${row.id}-${row.date}`,
        source_id: row.id,
        occurrence_date: row.date,
        is_scheduled: true,
        recurrence_key: `${row.id}:${row.date}`,
      }),
    );

  rows
    .filter(
      (row) => row.is_posted === false && isRecurring(row) && row.schedule_status === 'active',
    )
    .forEach((row) => {
      occurrenceDates(row, from, to).forEach((date) => {
        // A posted occurrence belongs to this schedule through schedule_id.
        // Legacy source rows are linked by the schedule's parent ID. Never
        // deduplicate by labels or amounts: unrelated income can match those.
        const received = actualRows.some(
          (actual) =>
            String(actual.date) === date &&
            (String(actual.schedule_id ?? '') === String(row.id) ||
              String(actual.id) === String(row.schedule_id ?? '')),
        );
        if (received) return;
        scheduled.push({
          ...row,
          id: `scheduled-${row.id}-${date}`,
          date,
          source_id: row.id,
          occurrence_date: date,
          is_scheduled: true,
          recurrence_key: `${row.id}:${date}`,
        });
      });
    });

  return [...actualRows, ...scheduled].sort((left, right) =>
    String(right.date).localeCompare(String(left.date)),
  );
}
