import { authenticatedApiRequest } from './api';

export type BillRecord = {
  id: string;
  title: string;
  amount: number | string;
  category: string;
  due_date: string;
  recurring: boolean;
  frequency: 'monthly' | 'weekly' | 'yearly' | 'quarterly' | null;
  status: 'unpaid' | 'paid' | 'overdue';
  paid_at: string | null;
};

export type SubscriptionRecord = {
  id: string;
  name: string;
  amount: number | string;
  renewal_date: string;
  billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  auto_renew: boolean;
};

export type FinanceItem = {
  id: string;
  source: 'bill' | 'subscription';
  name: string;
  amount: number;
  category: string;
  dueDate: string;
  recurring: boolean;
  frequency: BillRecord['frequency'] | SubscriptionRecord['billing_cycle'];
  paid: boolean;
};

export async function fetchFinanceItems() {
  const [billResult, subscriptionResult] = await Promise.allSettled([
    authenticatedApiRequest<BillRecord[]>('/api/bills'),
    authenticatedApiRequest<SubscriptionRecord[]>('/api/subscriptions'),
  ]);
  if (billResult.status === 'rejected' && subscriptionResult.status === 'rejected') {
    throw billResult.reason instanceof Error ? billResult.reason : new Error('Bills could not load.');
  }
  const bills = billResult.status === 'fulfilled' ? billResult.value : [];
  const subscriptions = subscriptionResult.status === 'fulfilled' ? subscriptionResult.value : [];
  const billItems: FinanceItem[] = bills.map((bill) => ({ id: bill.id, source: 'bill', name: bill.title, amount: Number(bill.amount), category: bill.category, dueDate: bill.due_date, recurring: bill.recurring, frequency: bill.frequency, paid: bill.status === 'paid' }));
  const subscriptionItems: FinanceItem[] = subscriptions.map((subscription) => ({ id: subscription.id, source: 'subscription', name: subscription.name, amount: Number(subscription.amount), category: 'Subscriptions', dueDate: subscription.renewal_date, recurring: true, frequency: subscription.billing_cycle, paid: false }));
  return [...billItems, ...subscriptionItems].sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

export function derivedStatus(item: FinanceItem, today = new Date().toISOString().slice(0, 10)) {
  if (item.paid) return 'Paid' as const;
  return item.dueDate < today ? 'Overdue' as const : 'Upcoming' as const;
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
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(originalDay, lastDay));
  }
  return next.toISOString().slice(0, 10);
}

export async function markFinanceItemPaid(item: FinanceItem) {
  if (item.source === 'bill') {
    return authenticatedApiRequest<BillRecord>(`/api/bills/${item.id}/pay`, { method: 'PATCH' });
  }
  const nextDate = addRecurrence(item.dueDate, item.frequency ?? 'monthly');
  return authenticatedApiRequest<SubscriptionRecord>(`/api/subscriptions/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ renewal_date: nextDate }) });
}

export async function deleteFinanceItem(item: FinanceItem) {
  const path = item.source === 'bill' ? `/api/bills/${item.id}` : `/api/subscriptions/${item.id}`;
  return authenticatedApiRequest(path, { method: 'DELETE' });
}
