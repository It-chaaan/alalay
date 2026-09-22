export type BudgetCategoryStatus =
  'no_spending' | 'on_track' | 'near_limit' | 'fully_used' | 'over_budget' | 'unallocated';

export function budgetCategoryStatus(spentValue: number | string, budgetValue: number | string) {
  const spent = Math.max(0, Number(spentValue) || 0);
  const budget = Math.max(0, Number(budgetValue) || 0);
  if (budget === 0)
    return {
      status: spent > 0 ? ('over_budget' as const) : ('unallocated' as const),
      spent,
      budget,
      percent: 0,
      progress: spent > 0 ? 100 : 0,
      remaining: -spent,
    };
  const ratio = spent / budget;
  const percent = Math.round(ratio * 100);
  const status: BudgetCategoryStatus =
    spent === 0
      ? 'no_spending'
      : ratio < 0.75
        ? 'on_track'
        : ratio < 1
          ? 'near_limit'
          : ratio === 1
            ? 'fully_used'
            : 'over_budget';
  return {
    status,
    spent,
    budget,
    percent,
    progress: Math.min(100, ratio * 100),
    remaining: budget - spent,
  };
}
