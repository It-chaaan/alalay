export type DatedExpense = {
  date: string;
  amount: number | string;
  created_at?: string;
  id?: string;
};

export type ExpenseDateGroup<T extends DatedExpense> = {
  date: string;
  subtotal: number;
  items: T[];
};

export function sortExpensesByDateDesc<T extends DatedExpense>(items: T[]) {
  return [...items].sort((left, right) => {
    const byDate = right.date.slice(0, 10).localeCompare(left.date.slice(0, 10));
    if (byDate) return byDate;

    const byCreatedAt = (right.created_at ?? "").localeCompare(left.created_at ?? "");
    if (byCreatedAt) return byCreatedAt;

    return (right.id ?? "").localeCompare(left.id ?? "");
  });
}

export function groupExpensesByDate<T extends DatedExpense>(items: T[]): ExpenseDateGroup<T>[] {
  const groups = new Map<string, ExpenseDateGroup<T>>();

  for (const item of sortExpensesByDateDesc(items)) {
    const date = item.date.slice(0, 10);
    const group = groups.get(date);
    if (group) {
      group.items.push(item);
      group.subtotal += Number(item.amount) || 0;
    } else {
      groups.set(date, { date, subtotal: Number(item.amount) || 0, items: [item] });
    }
  }

  return [...groups.values()];
}
