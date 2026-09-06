export type BudgetTemplateAllocation = {
  label: string;
  weight: number;
};

export type BudgetTemplate = {
  id: string;
  name: string;
  description: string;
  preview: string;
  allocations: BudgetTemplateAllocation[];
};

// This is the single recommended setup presented by the mobile picker.
export const recommendedBudgetTemplate: BudgetTemplate = {
  id: 'balanced',
  name: 'Recommended budget setup',
  description: 'Build an editable plan based on your income and spending.',
  preview: '50% Needs · 30% Wants · 20% Savings',
  allocations: [
    { label: 'Rent', weight: 0.2 },
    { label: 'Food', weight: 0.15 },
    { label: 'Electricity', weight: 0.1 },
    { label: 'Transport', weight: 0.05 },
    { label: 'Entertainment', weight: 0.15 },
    { label: 'Shopping', weight: 0.1 },
    { label: 'Savings', weight: 0.2 },
  ],
};
