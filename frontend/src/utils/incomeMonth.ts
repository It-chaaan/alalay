import type { IncomeEntry } from '../hooks/types';

export type IncomeMonthItem = {
  kind: 'recurring' | 'one_time'; sourceId: string; occurrenceId: string | null;
  isProjected: boolean; occurrenceKey: string; transactionId: string | null;
  name: string; category: string; amount: number; frequency: string | null;
  status: 'received' | 'upcoming' | 'expected_today' | 'overdue' | 'failed' | 'not_started';
  dueDate: string | null; receivedDate: string | null; receivedAt: string | null;
  createdAt: string | null; updatedAt: string | null; walletId: string;
};

export type IncomeMonth = { month: string; overview: { receivedAmount: number; expectedTodayAmount: number; upcomingAmount: number; overdueAmount: number; projectedAmount: number; receivedCount: number; expectedTodayCount: number; upcomingCount: number; overdueCount: number; recurringSourceCount: number; oneTimeCount: number; }; items: IncomeMonthItem[]; };
export type IncomeMonthEntry = IncomeEntry & { source_id: string; transaction_id: string | null; is_projected: boolean; status: IncomeMonthItem['status']; due_date: string | null; };

/** Desktop adapter for the shared month-scoped Income API contract used by mobile. */
export function incomeMonthEntries(items: IncomeMonthItem[]): IncomeMonthEntry[] {
  return items.map((item) => ({
    id: item.transactionId ?? `projection:${item.occurrenceKey}`, source: item.name,
    type: item.category, amount: item.amount, date: item.receivedDate ?? item.dueDate ?? '',
    is_recurring: item.kind === 'recurring',
    frequency: item.frequency === 'weekly' || item.frequency === 'biweekly' || item.frequency === 'monthly' || item.frequency === 'yearly' ? item.frequency : undefined,
    wallet_id: item.walletId, created_at: item.createdAt ?? '', source_id: item.sourceId,
    transaction_id: item.transactionId, is_projected: item.isProjected, status: item.status,
    due_date: item.dueDate,
  }));
}
