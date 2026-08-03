export function monthsUntil(deadline: string, from = new Date()) {
  const targetDate = new Date(`${deadline}T00:00:00`);
  const diffDays = Math.ceil((targetDate.getTime() - from.getTime()) / 86400000);

  return Math.max(1, Math.ceil(diffDays / 30));
}

export function getMonthlyNeeded(currentAmount: number, targetAmount: number, deadline: string) {
  const remaining = Math.max(0, targetAmount - currentAmount);

  return remaining ? remaining / monthsUntil(deadline) : 0;
}

export function getProjectedGoalDate(currentAmount: number, targetAmount: number, monthlyContribution: number) {
  const remaining = Math.max(0, targetAmount - currentAmount);

  if (!remaining || monthlyContribution <= 0) {
    return null;
  }

  const projectedDate = new Date();
  projectedDate.setMonth(projectedDate.getMonth() + Math.ceil(remaining / monthlyContribution));
  return projectedDate;
}
