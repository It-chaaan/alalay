export const workflows = [
  [
    'auth.login',
    'Auth / Profile',
    'PARITY',
    'P2',
    ['mobile/src/app/auth.tsx', 'frontend/src/pages/auth/AuthPage.tsx'],
  ],
  [
    'profile.settings',
    'Auth / Profile',
    'PARITY',
    'P2',
    ['mobile/src/app/(tabs)/settings/index.tsx', 'frontend/src/pages/dashboard/SettingsPage.tsx'],
  ],
  [
    'dashboard.summary',
    'Dashboard',
    'PARTIAL',
    'P2',
    ['mobile/src/app/(tabs)/index.tsx', 'frontend/src/pages/dashboard/DashboardPage.tsx'],
  ],
  [
    'dashboard.privacy',
    'Dashboard',
    'PARTIAL',
    'P2',
    [
      'mobile/src/hooks/use-balance-visibility.ts',
      'frontend/src/pages/dashboard/DashboardPage.tsx',
    ],
  ],
  [
    'wallet.create',
    'Wallets',
    'PARITY',
    'P1',
    [
      'mobile/src/app/(tabs)/wallets.tsx',
      'frontend/src/pages/dashboard/WalletsPage.tsx',
      'backend/src/services/wallets.service.ts',
    ],
  ],
  [
    'wallet.transfer',
    'Wallets',
    'PARITY',
    'P0',
    [
      'mobile/src/app/(tabs)/wallets.tsx',
      'frontend/src/pages/dashboard/WalletsPage.tsx',
      'backend/src/services/wallets.service.ts',
    ],
  ],
  [
    'wallet.transfer-fee',
    'Wallets',
    'PARTIAL',
    'P2',
    ['backend/src/services/wallets.service.ts', 'frontend/src/pages/dashboard/WalletsPage.tsx'],
  ],
  [
    'bill.create',
    'Bills',
    'PARITY',
    'P1',
    [
      'mobile/src/app/(tabs)/bills.tsx',
      'frontend/src/components/forms/FinancialActionPanels.tsx',
      'backend/src/services/bills.service.ts',
    ],
  ],
  [
    'bill.pay',
    'Bills',
    'PARITY',
    'P0',
    [
      'mobile/src/app/(tabs)/bills.tsx',
      'frontend/src/components/dashboard/BillsComponents.tsx',
      'backend/src/services/bills.service.ts',
    ],
  ],
  [
    'bill.credit-payment',
    'Bills',
    'MANUAL_REVIEW',
    'P1',
    ['mobile/src/app/(tabs)/bills.tsx', 'backend/src/services/bills.service.ts'],
  ],
  [
    'subscription.create',
    'Subscriptions',
    'PARITY',
    'P1',
    [
      'mobile/src/app/(tabs)/subscriptions.tsx',
      'frontend/src/components/forms/FinancialActionPanels.tsx',
      'backend/src/services/subscription-billing.service.ts',
    ],
  ],
  [
    'subscription.toggle',
    'Subscriptions',
    'PARITY',
    'P2',
    [
      'mobile/src/app/(tabs)/subscriptions.tsx',
      'frontend/src/pages/dashboard/SubscriptionsPage.tsx',
    ],
  ],
  [
    'expense.create',
    'Expenses',
    'PARITY',
    'P1',
    [
      'mobile/src/app/(tabs)/expenses.tsx',
      'frontend/src/components/forms/FinancialActionPanels.tsx',
      'backend/src/schemas/expense.schema.ts',
    ],
  ],
  [
    'expense.credit',
    'Expenses',
    'MANUAL_REVIEW',
    'P0',
    ['mobile/src/app/(tabs)/expenses.tsx', 'backend/src/services/crud.service.ts'],
  ],
  [
    'income.create',
    'Income',
    'PARITY',
    'P1',
    [
      'mobile/src/app/(tabs)/income.tsx',
      'frontend/src/components/forms/FinancialActionPanels.tsx',
      'backend/src/schemas/income.schema.ts',
    ],
  ],
  [
    'income.recurrence',
    'Income',
    'PARITY',
    'P1',
    [
      'mobile/src/app/(tabs)/income.tsx',
      'frontend/src/components/forms/FinancialActionPanels.tsx',
      'backend/src/services/income-recurrence.service.ts',
    ],
  ],
  [
    'income.categories',
    'Income',
    'PARTIAL',
    'P2',
    [
      'shared/category-registry.ts',
      'mobile/src/constants/categories.ts',
      'frontend/src/components/ui/CategoryIcon.tsx',
    ],
  ],
  [
    'goal.create',
    'Goals',
    'PARITY',
    'P1',
    [
      'mobile/src/app/(tabs)/savings.tsx',
      'frontend/src/components/forms/FinancialActionPanels.tsx',
    ],
  ],
  [
    'goal.contribute',
    'Goals',
    'PARITY',
    'P0',
    [
      'mobile/src/app/(tabs)/savings.tsx',
      'frontend/src/components/forms/FinancialActionPanels.tsx',
      'backend/src/controllers/resource.controller.ts',
    ],
  ],
  [
    'goal.delete',
    'Goals',
    'MANUAL_REVIEW',
    'P1',
    ['mobile/src/app/(tabs)/savings.tsx', 'backend/src/services/resource.service.ts'],
  ],
  [
    'loan.lend-borrow',
    'Loans & Debt',
    'PARITY',
    'P0',
    ['mobile/src/app/loans.tsx', 'backend/src/services/loans.service.ts'],
  ],
  [
    'loan.repay',
    'Loans & Debt',
    'MANUAL_REVIEW',
    'P1',
    ['mobile/src/app/loans.tsx', 'backend/src/services/loans.service.ts'],
  ],
  [
    'budget.plan',
    'Budget',
    'PARITY',
    'P1',
    [
      'mobile/src/app/(tabs)/budget.tsx',
      'frontend/src/pages/dashboard/BudgetPage.tsx',
      'backend/src/schemas/budget.schema.ts',
    ],
  ],
  [
    'reports.analytics',
    'Reports',
    'PARITY',
    'P2',
    [
      'mobile/src/app/(tabs)/reports.tsx',
      'frontend/src/pages/dashboard/ReportsPage.tsx',
      'backend/src/services/analytics.service.ts',
    ],
  ],
  [
    'ocr.receipt',
    'OCR',
    'PARTIAL',
    'P2',
    [
      'mobile/src/app/(tabs)/ocr.tsx',
      'frontend/src/pages/dashboard/OcrScannerPage.tsx',
      'backend/src/services/receipt-ocr.service.ts',
    ],
  ],
  [
    'ai.assistant',
    'AI Assistant',
    'PARITY',
    'P2',
    [
      'mobile/src/services/api.ts',
      'frontend/src/pages/dashboard/AiAssistantPage.tsx',
      'backend/src/services/ai.service.ts',
    ],
  ],
  [
    'notifications.reminders',
    'Notifications',
    'PARTIAL',
    'P2',
    [
      'mobile/src/services/financial-reminders.ts',
      'backend/src/services/notification-scheduler.service.ts',
      'frontend/src/hooks/useNotificationPreferences.ts',
    ],
  ],
];

export const financialContracts = [
  [
    'income.wallet',
    'Income deposits into the selected wallet through the backend income contract.',
    'backend/src/schemas/income.schema.ts',
  ],
  [
    'expense.wallet',
    'Expenses carry an owned wallet ID and are included in wallet recomputation.',
    'backend/src/schemas/expense.schema.ts',
  ],
  [
    'transfer.fee',
    'Transfer principal stays outside income/spending; only the fee becomes an expense.',
    'backend/src/services/wallets.service.ts',
  ],
  [
    'goal.contribution',
    'Goal contributions use the atomic goal contribution RPC and do not create income or expense.',
    'backend/src/controllers/resource.controller.ts',
  ],
  [
    'loan.interest',
    'Only loan interest is recorded in income or expenses.',
    'backend/src/services/loans.service.ts',
  ],
];

export const criticalEvidence = {
  'income.create': [
    ['frontend/src/components/forms/FinancialActionPanels.tsx', 'id="income-wallet"'],
    ['backend/src/schemas/income.schema.ts', 'wallet_id: z.string().uuid()'],
  ],
  'subscription.create': [
    ['frontend/src/components/forms/FinancialActionPanels.tsx', 'id="subscription-wallet"'],
    ['backend/src/services/subscription-billing.service.ts', 'wallet_id'],
  ],
  'goal.contribute': [
    ['frontend/src/components/forms/FinancialActionPanels.tsx', 'contributions'],
    ['backend/src/controllers/resource.controller.ts', 'add_goal_contribution'],
  ],
  'wallet.transfer': [
    ['frontend/src/pages/dashboard/WalletsPage.tsx', "'/wallets/transfers'"],
    ['backend/src/services/wallets.service.ts', 'create_wallet_transfer'],
  ],
  'bill.pay': [
    ['frontend/src/pages/dashboard/BillsPage.tsx', '/pay'],
    ['backend/src/services/bills.service.ts', 'payBill'],
    [
      'supabase/migrations/20260818140000_fix_bill_payment_occurrence_ambiguity.sql',
      'v_occurrence_date',
    ],
    ['supabase/tests/bill_payment_occurrence.sql', 'source_bill_occurrence_date'],
  ],
};
