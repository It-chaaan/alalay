export function budgetUsagePercent(spent: number, budget: number) {
  return budget > 0 ? Math.round(spent / budget * 100) : 0;
}

export function budgetProgressPercent(spent: number, budget: number) {
  return budget > 0 ? Math.min(100, Math.max(0, spent / budget * 100)) : 0;
}
