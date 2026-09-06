import { recommendedBudgetTemplate } from '@shared/budget-templates';

export type BudgetDraftCategory = {
  id: string;
  name: string;
  budget: number;
};

export function previousBudgetMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const previous = new Date(year, monthNumber - 2, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
}

function categoryId(prefix: string, name: string) {
  return `${prefix}-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

/** Copy only the locally editable fields; spending and transaction data never enter a draft. */
export function copyPreviousBudgetCategories(
  categories: Array<{ id: string; name: string; budget: number; goal?: boolean }>,
) {
  return categories
    .filter((category) => !category.goal)
    .map((category) => ({
      id: categoryId('budget-copy', category.name),
      name: category.name,
      budget: Number(category.budget),
    }));
}

/** Mirrors the mobile recommended-template merge and rounding behaviour. */
export function mergeRecommendedBudgetCategories(
  current: BudgetDraftCategory[],
  monthlyBudget: number,
) {
  const templateEntries = recommendedBudgetTemplate.allocations.map((allocation) => {
    const existing = current.find(
      (category) => category.name.toLowerCase() === allocation.label.toLowerCase(),
    );
    return {
      id: existing?.id ?? categoryId('budget', allocation.label),
      name: existing?.name ?? allocation.label,
      budget: existing?.budget ?? Math.round(monthlyBudget * allocation.weight),
    };
  });
  const templateIds = new Set(templateEntries.map((entry) => entry.id));
  return [...current.filter((entry) => !templateIds.has(entry.id)), ...templateEntries];
}
