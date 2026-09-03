export type BillOccurrenceStatus = 'paid' | 'overdue' | 'due_soon' | 'upcoming';

export type PersistedBillOccurrence = {
  id: string;
  bill_id: string;
  user_id: string;
  occurrence_date: string;
  occurrence_period: string;
  status: 'unpaid' | 'paid' | 'overdue';
  paid_at?: string | null;
  wallet_id?: string | null;
  expense_id?: string | null;
  bill?: Record<string, unknown> | null;
};

export type MaterializedBillOccurrence = Record<string, unknown> & {
  id: string;
  bill_id: string;
  occurrence_date: string;
  occurrence_period: string;
  due_date: string;
  status: BillOccurrenceStatus;
  paid_at: string | null;
  amount: unknown;
  category: string;
  title: string;
};

export function monthKey(date: string) { return date.slice(0, 7); }

export function monthBounds(month: string) {
  const [year, value] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, value, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` };
}

/** Date-only arithmetic; input and output are Manila calendar dates, not instants. */
export function occurrenceDateFromAnchor(anchor: string, frequency: string, index: number) {
  const [year, month, day] = anchor.slice(0, 10).split('-').map(Number);
  if (frequency === 'weekly') {
    return new Date(Date.UTC(year, month - 1, day + index * 7)).toISOString().slice(0, 10);
  }
  const step = frequency === 'quarterly' ? 3 : frequency === 'yearly' ? 12 : 1;
  const target = new Date(Date.UTC(year, month - 1 + index * step, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

export function occurrenceStatus(occurrence: Pick<PersistedBillOccurrence, 'status' | 'paid_at' | 'occurrence_date'>, today: string): BillOccurrenceStatus {
  if (occurrence.status === 'paid' || occurrence.paid_at) return 'paid';
  if (occurrence.occurrence_date < today) return 'overdue';
  const dueSoon = new Date(`${today}T12:00:00Z`);
  dueSoon.setUTCDate(dueSoon.getUTCDate() + 7);
  return occurrence.occurrence_date <= dueSoon.toISOString().slice(0, 10) ? 'due_soon' : 'upcoming';
}

/** Merge a schedule with an occurrence without allowing legacy template state to win. */
export function materializeBillOccurrence(row: PersistedBillOccurrence & { bill?: Record<string, unknown> | Record<string, unknown>[] | null }, today: string): MaterializedBillOccurrence {
  const template = Array.isArray(row.bill) ? row.bill[0] : row.bill;
  return {
    ...(template ?? {}),
    ...row,
    id: row.id,
    bill_id: row.bill_id,
    occurrence_date: row.occurrence_date,
    occurrence_period: row.occurrence_period,
    due_date: row.occurrence_date,
    status: occurrenceStatus(row, today),
    paid_at: row.paid_at ?? null,
  } as unknown as MaterializedBillOccurrence;
}

export function splitOccurrencesForMonth<T extends { occurrence_date: string; status: string; paid_at?: string | null }>(occurrences: T[], month: string, today: string) {
  const { start } = monthBounds(month);
  return {
    items: occurrences.filter((row) => monthKey(row.occurrence_date) === month),
    overdue_items: occurrences.filter((row) => row.occurrence_date < start && occurrenceStatus(row as unknown as PersistedBillOccurrence, today) === 'overdue'),
  };
}
