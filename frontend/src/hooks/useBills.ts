import { ApiRequestError } from '../lib/apiClient';
import { useApiQuery } from './useApiQuery';
import type { Bill } from './types';

type BillListResponse = {
  month: string;
  items: Bill[];
  overdue_items: Bill[];
  overview: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isBill(value: unknown): value is Bill {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    (typeof value.amount === 'number' || typeof value.amount === 'string') &&
    typeof value.category === 'string' &&
    typeof value.due_date === 'string' &&
    typeof value.recurring === 'boolean' &&
    (typeof value.frequency === 'string' || value.frequency === null) &&
    (value.status === 'unpaid' || value.status === 'paid' || value.status === 'overdue' || value.status === 'due_soon' || value.status === 'upcoming') &&
    (typeof value.paid_at === 'string' || value.paid_at === null) &&
    typeof value.created_at === 'string'
  );
}

/** Converts the documented `/bills` envelope into the stable client list contract. */
export function parseBillListResponse(value: unknown): Bill[] {
  if (!isRecord(value) || !Array.isArray(value.items) || !Array.isArray(value.overdue_items)) {
    throw new ApiRequestError(
      "We couldn't load your bills. Please try again.",
      'invalid_response',
    );
  }
  const rows = [...value.items, ...value.overdue_items];
  if (!rows.every(isBill)) {
    throw new ApiRequestError(
      "We couldn't load your bills. Please try again.",
      'invalid_response',
    );
  }
  return Array.from(new Map(rows.map((bill) => [bill.id, bill])).values());
}

export function useBills() {
  const query = useApiQuery<unknown>('/bills');
  if (query.data === null) return query as typeof query & { data: Bill[] | null };
  try {
    return { ...query, data: parseBillListResponse(query.data) };
  } catch (error) {
    return {
      ...query,
      data: null,
      error: error instanceof Error ? error.message : "We couldn't load your bills. Please try again.",
    };
  }
}
