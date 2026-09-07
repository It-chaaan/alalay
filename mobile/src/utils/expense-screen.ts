export type ExpenseListItem = {
  id: string;
  date: string;
  amount: number | string;
  created_at?: string;
};

export type ExpenseGroup<T extends ExpenseListItem> = { date: string; subtotal: number; items: T[] };

export function expenseRequestIntent(id?: string) {
  return id
    ? { path: `/api/expenses/${id}`, method: 'PATCH' as const }
    : { path: '/api/expenses', method: 'POST' as const };
}

export function expenseDeleteRequestIntent(id: string) {
  return { path: `/api/expenses/${id}`, method: 'DELETE' as const };
}

export function canApplyExpenseResponse({
  requestId,
  currentRequestId,
  focused,
}: {
  requestId: number;
  currentRequestId: number;
  focused: boolean;
}) {
  return focused && requestId === currentRequestId;
}

export function canStartExpenseSave(saving: boolean) {
  return !saving;
}

export function expenseCentavos(value: number | string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function groupExpenseRows<T extends ExpenseListItem>(items: T[]): ExpenseGroup<T>[] {
  const groups = new Map<string, ExpenseGroup<T>>();
  items
    .slice()
    .sort((left, right) =>
      (right.date + (right.created_at ?? right.id)).localeCompare(
        left.date + (left.created_at ?? left.id),
      ),
    )
    .forEach((item) => {
      const date = item.date.slice(0, 10);
      const group = groups.get(date);
      if (group) {
        group.items.push(item);
        group.subtotal = (expenseCentavos(group.subtotal) + expenseCentavos(item.amount)) / 100;
      } else {
        groups.set(date, { date, subtotal: expenseCentavos(item.amount) / 100, items: [item] });
      }
    });
  return Array.from(groups.values());
}

export function walletAvailableForExpense(wallet: {
  balance: number | string;
  available_balance?: number | string;
}) {
  return Number(wallet.available_balance ?? wallet.balance) || 0;
}
