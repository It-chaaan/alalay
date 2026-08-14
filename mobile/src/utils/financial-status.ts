export type DerivedFinancialStatus = 'Paid' | 'Upcoming' | 'Due soon' | 'Due today' | 'Overdue';

export function deriveFinancialStatus(item: { paid: boolean; dueDate: string }, today: string): DerivedFinancialStatus {
  if (item.paid) return 'Paid';
  if (item.dueDate < today) return 'Overdue';
  if (item.dueDate === today) return 'Due today';
  const [dueYear, dueMonth, dueDay] = item.dueDate.slice(0, 10).split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  const daysUntilDue = Math.round((Date.UTC(dueYear, dueMonth - 1, dueDay) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86_400_000);
  return daysUntilDue <= 3 ? 'Due soon' : 'Upcoming';
}
