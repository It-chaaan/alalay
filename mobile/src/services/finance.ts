import { authenticatedApiRequest } from './api';
import { deriveFinancialStatus } from '../utils/financial-status';

export type BillRecord = {
  id: string;
  title: string;
  amount: number | string;
  category: string;
  custom_category?: string | null;
  due_date: string;
  recurring: boolean;
  frequency: 'monthly' | 'weekly' | 'yearly' | 'quarterly' | null;
  status: 'unpaid' | 'paid' | 'overdue';
  paid_at: string | null;
  wallet_id?: string | null;
};

export type SubscriptionRecord = {
  id: string;
  name: string;
  amount: number | string;
  renewal_date: string;
  billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  auto_renew: boolean;
  wallet_id?: string | null;
};

export type FinanceItem = {
  id: string;
  source: 'bill' | 'subscription';
  name: string;
  amount: number;
  category: string;
  custom_category?: string | null;
  dueDate: string;
  recurring: boolean;
  frequency: BillRecord['frequency'] | SubscriptionRecord['billing_cycle'];
  paid: boolean;
  wallet_id?: string | null;
};

export type ExpenseRecord = {
  id: string;
  merchant: string;
  amount: number | string;
  category: string;
  categories?: string[];
  custom_category?: string | null;
  date: string;
  payment_method?: string;
  wallet_id?: string | null;
  created_at?: string;
};

export type IncomeRecord = {
  id: string;
  source: string;
  type: string;
  amount: number | string;
  date: string;
  is_recurring: boolean;
  frequency?: string | null;
  wallet_id?: string | null;
  is_scheduled?: boolean;
};

export type Payday = { date: string; amount: number; source: string };

export type RecentTransaction = {
  id: string;
  sourceType: 'income' | 'expense';
  title: string;
  category: string;
  amount: number;
  occurredAt: string;
  walletId?: string | null;
  frequency?: string | null;
  isRecurringOccurrence?: boolean;
};

export type WalletRecord = {
  id: string;
  name: string;
  institution_type: string;
  institution_key: string;
  account_type?: 'debit' | 'credit' | null;
  credit_limit?: number | string | null;
  balance: number | string;
  color: string;
  icon?: string | null;
  is_default_cash: boolean;
};

export function fetchWallets() {
  return authenticatedApiRequest<WalletRecord[]>('/api/wallets');
}

export type LoanSummaryResponse = {
  loans: { id: string; status: 'active' | 'paid' | 'written_off' }[];
  summary: { owed_to_me: number; i_owe: number };
};

export function fetchLoanSummary() {
  return authenticatedApiRequest<LoanSummaryResponse>('/api/loans');
}

/** Uses the same server-computed wallet balances shown by Wallets Overview. */
export function totalWalletBalance(wallets: Pick<WalletRecord, 'balance' | 'account_type'>[]) {
  return wallets.reduce((sum, wallet) => {
    if (wallet.account_type === 'credit') return sum;
    const balance = Number(wallet.balance);
    return sum + (Number.isFinite(balance) ? balance : 0);
  }, 0);
}

export type SavingsDashboard = {
  overview: {
    totalSavings: number;
    goalSavings: number;
    activeGoals: number;
    monthlyContribution: number;
  };
  goals: {
    id: string;
    title: string;
    emoji?: string;
    target_amount: number | string;
    current_amount: number | string;
    deadline: string;
    completed_at?: string | null;
  }[];
};

function recentRange() {
  const end = dateKeyInManila();
  const [year, month, day] = end.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day - 90));
  return { from: start.toISOString().slice(0, 10), to: end };
}

export function dateKeyInManila(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const isDevelopment = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
export function normalizeExpense(expense: ExpenseRecord): RecentTransaction {
  const occurredAt = expense.date?.slice(0, 10) || expense.created_at?.slice(0, 10) || '1970-01-01';
  if (!expense.date && isDevelopment)
    console.warn('[finance] Expense missing authoritative date', { id: expense.id });
  return {
    id: `expense-${expense.id}`,
    sourceType: 'expense',
    title: expense.merchant || 'Expense',
    category: expense.custom_category ?? expense.category ?? 'Uncategorized',
    amount: -Math.abs(Number(expense.amount) || 0),
    occurredAt,
    walletId: expense.wallet_id,
  };
}

const financialMutationListeners = new Set<() => void>();
export function subscribeFinancialMutations(listener: () => void) {
  financialMutationListeners.add(listener);
  return () => {
    financialMutationListeners.delete(listener);
  };
}
export function notifyFinancialMutation() {
  financialMutationListeners.forEach((listener) => listener());
}

export function fetchExpenses(range = recentRange()) {
  return authenticatedApiRequest<ExpenseRecord[]>(
    `/api/expenses?from=${range.from}&to=${range.to}`,
  );
}

export function fetchIncome() {
  return authenticatedApiRequest<IncomeRecord[]>('/api/income');
}

export async function fetchNextPayday() {
  try {
    return await authenticatedApiRequest<Payday | null>('/api/income/next-payday');
  } catch (error) {
    // Older backend deployments do not have the semantic endpoint yet. Fall
    // back to the existing occurrence API, whose rows are expanded by the
    // shared backend recurrence engine.
    if (
      !(error instanceof Error) ||
      !('status' in error) ||
      (error as { status?: number }).status !== 404
    )
      throw error;
    const from = dateKeyInManila();
    const [year, month, day] = from.split('-').map(Number);
    const end = new Date(Date.UTC(year, month - 1, day));
    end.setUTCDate(end.getUTCDate() + 400);
    const to = end.toISOString().slice(0, 10);
    const rows = await authenticatedApiRequest<IncomeRecord[]>(
      `/api/income/occurrences?from=${from}&to=${to}`,
    );
    const candidates = rows.filter(
      (row) => row.is_scheduled && row.is_recurring && row.date >= from,
    );
    const salary = candidates.filter(
      (row) => String(row.type ?? '').toLowerCase() === 'salary' || /payroll/i.test(row.source),
    );
    const eligible = salary.length ? salary : candidates;
    eligible.sort(
      (left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
    );
    const selected = eligible[0];
    return selected
      ? {
          date: selected.date.slice(0, 10),
          amount: Number(selected.amount) || 0,
          source: selected.source || 'Income',
        }
      : null;
  }
}

export function fetchRecentIncome(range = recentRange()) {
  return authenticatedApiRequest<IncomeRecord[]>(
    `/api/income/occurrences?from=${range.from}&to=${range.to}`,
  );
}

export function combineRecentTransactions(expenses: ExpenseRecord[], income: IncomeRecord[]) {
  const expenseTransactions = expenses.map(normalizeExpense);
  const incomeTransactions: RecentTransaction[] = income.map((entry) => ({
    id: `income-${entry.id}`,
    sourceType: 'income',
    title: entry.source,
    category: entry.type,
    amount: Math.abs(Number(entry.amount) || 0),
    occurredAt: entry.date,
    walletId: entry.wallet_id,
    frequency: entry.frequency,
    isRecurringOccurrence: entry.is_scheduled === true,
  }));
  return [...expenseTransactions, ...incomeTransactions].sort((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt),
  );
}

export function fetchSavingsDashboard() {
  return authenticatedApiRequest<SavingsDashboard>('/api/savings-goals/summary');
}

export async function fetchFinanceItems() {
  const [billResult, subscriptionResult] = await Promise.allSettled([
    authenticatedApiRequest<BillRecord[]>('/api/bills'),
    authenticatedApiRequest<SubscriptionRecord[]>('/api/subscriptions'),
  ]);
  if (billResult.status === 'rejected' && subscriptionResult.status === 'rejected') {
    throw billResult.reason instanceof Error
      ? billResult.reason
      : new Error('Bills could not load.');
  }
  const bills = billResult.status === 'fulfilled' ? billResult.value : [];
  const subscriptions = subscriptionResult.status === 'fulfilled' ? subscriptionResult.value : [];
  const billItems: FinanceItem[] = bills.map((bill) => ({
    id: bill.id,
    source: 'bill',
    name: bill.title,
    amount: Number(bill.amount),
    category: bill.category,
    custom_category: bill.custom_category,
    dueDate: bill.due_date,
    recurring: bill.recurring,
    frequency: bill.frequency,
    paid: bill.status === 'paid',
    wallet_id: bill.wallet_id,
  }));
  const subscriptionItems: FinanceItem[] = subscriptions.map((subscription) => ({
    id: subscription.id,
    source: 'subscription',
    name: subscription.name,
    amount: Number(subscription.amount),
    category: 'Subscriptions',
    dueDate: subscription.renewal_date,
    recurring: true,
    frequency: subscription.billing_cycle,
    paid: false,
    wallet_id: subscription.wallet_id,
  }));
  return [...billItems, ...subscriptionItems].sort((left, right) =>
    left.dueDate.localeCompare(right.dueDate),
  );
}

export function derivedStatus(item: FinanceItem, today = dateKeyInManila()) {
  return deriveFinancialStatus(item, today);
}

export function addRecurrence(date: string, frequency: Exclude<FinanceItem['frequency'], null>) {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  if (frequency === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  else {
    const months = frequency === 'quarterly' ? 3 : frequency === 'yearly' ? 12 : 1;
    const originalDay = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + months);
    const lastDay = new Date(
      Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
    ).getUTCDate();
    next.setUTCDate(Math.min(originalDay, lastDay));
  }
  return next.toISOString().slice(0, 10);
}

export async function markFinanceItemPaid(
  item: FinanceItem,
  payment?: { wallet_id: string; payment_date: string; occurrence_date?: string },
) {
  if (item.source === 'bill') {
    if (!payment) throw new Error('Select a payment wallet and date.');
    const result = await authenticatedApiRequest<BillRecord>(`/api/bills/${item.id}/pay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payment, occurrence_date: item.dueDate }),
    });
    const { cancelBillReminders } = await import('./financial-reminders');
    await cancelBillReminders(item.id);
    notifyFinancialMutation();
    return result;
  }
  const nextDate = addRecurrence(item.dueDate, item.frequency ?? 'monthly');
  const result = await authenticatedApiRequest<SubscriptionRecord>(
    `/api/subscriptions/${item.id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ renewal_date: nextDate }),
    },
  );
  notifyFinancialMutation();
  return result;
}

export async function deleteFinanceItem(item: FinanceItem) {
  const path = item.source === 'bill' ? `/api/bills/${item.id}` : `/api/subscriptions/${item.id}`;
  const result = await authenticatedApiRequest(path, { method: 'DELETE' });
  if (item.source === 'bill') {
    const { cancelBillReminders } = await import('./financial-reminders');
    await cancelBillReminders(item.id);
  }
  return result;
}
