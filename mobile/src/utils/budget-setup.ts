import type { BudgetTemplate } from '@shared/budget-templates';

export type BudgetSetupCategory = {
  id: string;
  name: string;
  budget: number;
  icon?: string;
  goal?: boolean;
};

export type BudgetSetupEntry = {
  id: string;
  name: string;
  budget: number;
  icon?: string;
  persisted: boolean;
};

export function previousBudgetMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const previousMonthNumber = monthNumber === 1 ? 12 : monthNumber - 1;
  const previousYear = monthNumber === 1 ? year - 1 : year;
  return `${previousYear}-${String(previousMonthNumber).padStart(2, '0')}`;
}

export function copiedBudgetEntries(categories: BudgetSetupCategory[]): BudgetSetupEntry[] {
  return categories
    .filter((category) => !category.goal)
    .map(({ id, name, budget, icon }) => ({
      id,
      name,
      budget,
      icon,
      // A copied setup is a local draft until the form's explicit Save action.
      persisted: false,
    }));
}

export function recommendedBudgetEntries({
  categories,
  template,
  monthlyBudget,
}: {
  categories: BudgetSetupCategory[];
  template: BudgetTemplate;
  monthlyBudget: number;
}): BudgetSetupEntry[] {
  const existingEntries = categories
    .filter((category) => !category.goal)
    .map(({ id, name, budget, icon }) => ({ id, name, budget, icon, persisted: true }));
  const templateEntries = template.allocations.map((allocation) => {
    const existing = existingEntries.find(
      (entry) => entry.name.toLowerCase() === allocation.label.toLowerCase(),
    );
    return {
      id: existing?.id ?? `budget-${allocation.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: existing?.name ?? allocation.label,
      budget: existing?.budget ?? Math.round(monthlyBudget * allocation.weight),
      icon: existing?.icon,
      persisted: Boolean(existing),
    };
  });
  return [
    ...existingEntries.filter((entry) => !templateEntries.some((item) => item.id === entry.id)),
    ...templateEntries,
  ];
}

export function canApplyBudgetSetup({
  capturedMonth,
  activeMonth,
  dialogOpen,
}: {
  capturedMonth: string;
  activeMonth: string;
  dialogOpen: boolean;
}) {
  return dialogOpen && capturedMonth === activeMonth;
}

export function canStartBudgetSave(isSaving: boolean) {
  return !isSaving;
}
