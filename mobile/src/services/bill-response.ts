export type BillApiList<T> = { month: string; items: T[]; overdue_items: T[] };

/** Normalize legacy Bill[] and occurrence-aware Bills API payloads at one boundary. */
export function normalizeBillListResponse<T>(value: BillApiList<T> | T[]): BillApiList<T> {
  if (Array.isArray(value)) return { month: '', items: value, overdue_items: [] };
  return {
    month: typeof value?.month === 'string' ? value.month : '',
    items: Array.isArray(value?.items) ? value.items : [],
    overdue_items: Array.isArray(value?.overdue_items) ? value.overdue_items : [],
  };
}
