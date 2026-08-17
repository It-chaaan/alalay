# Mobile → Web Workflow Parity Report
Generated: 2026-08-16T13:34:22.787Z
## Summary
- PARITY: 17
- PARTIAL: 6
- MISSING: 0
- DIFFERENT: 0
- MANUAL_REVIEW: 4
## Auth / Profile
### auth.login
- Status: PARITY
- Severity: P2
- Evidence: `mobile/src/app/auth.tsx`, `frontend/src/pages/auth/AuthPage.tsx`
### profile.settings
- Status: PARITY
- Severity: P2
- Evidence: `mobile/src/app/(tabs)/settings/index.tsx`, `frontend/src/pages/dashboard/SettingsPage.tsx`
## Dashboard
### dashboard.summary
- Status: PARTIAL
- Severity: P2
- Evidence: `mobile/src/app/(tabs)/index.tsx`, `frontend/src/pages/dashboard/DashboardPage.tsx`
### dashboard.privacy
- Status: PARTIAL
- Severity: P2
- Evidence: `mobile/src/hooks/use-balance-visibility.ts`, `frontend/src/pages/dashboard/DashboardPage.tsx`
## Wallets
### wallet.create
- Status: PARITY
- Severity: P1
- Evidence: `mobile/src/app/(tabs)/wallets.tsx`, `frontend/src/pages/dashboard/WalletsPage.tsx`, `backend/src/services/wallets.service.ts`
### wallet.transfer
- Status: PARITY
- Severity: P0
- Evidence: `mobile/src/app/(tabs)/wallets.tsx`, `frontend/src/pages/dashboard/WalletsPage.tsx`, `backend/src/services/wallets.service.ts`
### wallet.transfer-fee
- Status: PARTIAL
- Severity: P2
- Evidence: `backend/src/services/wallets.service.ts`, `frontend/src/pages/dashboard/WalletsPage.tsx`
## Bills
### bill.create
- Status: PARITY
- Severity: P1
- Evidence: `mobile/src/app/(tabs)/bills.tsx`, `frontend/src/components/forms/FinancialActionPanels.tsx`, `backend/src/services/bills.service.ts`
### bill.pay
- Status: PARITY
- Severity: P0
- Evidence: `mobile/src/app/(tabs)/bills.tsx`, `frontend/src/components/dashboard/BillsComponents.tsx`, `backend/src/services/bills.service.ts`
### bill.credit-payment
- Status: MANUAL_REVIEW
- Severity: P1
- Evidence: `mobile/src/app/(tabs)/bills.tsx`, `backend/src/services/bills.service.ts`
## Subscriptions
### subscription.create
- Status: PARITY
- Severity: P1
- Evidence: `mobile/src/app/(tabs)/subscriptions.tsx`, `frontend/src/components/forms/FinancialActionPanels.tsx`, `backend/src/services/subscription-billing.service.ts`
### subscription.toggle
- Status: PARITY
- Severity: P2
- Evidence: `mobile/src/app/(tabs)/subscriptions.tsx`, `frontend/src/pages/dashboard/SubscriptionsPage.tsx`
## Expenses
### expense.create
- Status: PARITY
- Severity: P1
- Evidence: `mobile/src/app/(tabs)/expenses.tsx`, `frontend/src/components/forms/FinancialActionPanels.tsx`, `backend/src/schemas/expense.schema.ts`
### expense.credit
- Status: MANUAL_REVIEW
- Severity: P0
- Evidence: `mobile/src/app/(tabs)/expenses.tsx`, `backend/src/services/crud.service.ts`
## Income
### income.create
- Status: PARITY
- Severity: P1
- Evidence: `mobile/src/app/(tabs)/income.tsx`, `frontend/src/components/forms/FinancialActionPanels.tsx`, `backend/src/schemas/income.schema.ts`
### income.recurrence
- Status: PARITY
- Severity: P1
- Evidence: `mobile/src/app/(tabs)/income.tsx`, `frontend/src/components/forms/FinancialActionPanels.tsx`, `backend/src/services/income-recurrence.service.ts`
### income.categories
- Status: PARTIAL
- Severity: P2
- Evidence: `shared/category-registry.ts`, `mobile/src/constants/categories.ts`, `frontend/src/components/ui/CategoryIcon.tsx`
## Goals
### goal.create
- Status: PARITY
- Severity: P1
- Evidence: `mobile/src/app/(tabs)/savings.tsx`, `frontend/src/components/forms/FinancialActionPanels.tsx`
### goal.contribute
- Status: PARITY
- Severity: P0
- Evidence: `mobile/src/app/(tabs)/savings.tsx`, `frontend/src/components/forms/FinancialActionPanels.tsx`, `backend/src/controllers/resource.controller.ts`
### goal.delete
- Status: MANUAL_REVIEW
- Severity: P1
- Evidence: `mobile/src/app/(tabs)/savings.tsx`, `backend/src/services/resource.service.ts`
## Loans & Debt
### loan.lend-borrow
- Status: PARITY
- Severity: P0
- Evidence: `mobile/src/app/loans.tsx`, `backend/src/services/loans.service.ts`
### loan.repay
- Status: MANUAL_REVIEW
- Severity: P1
- Evidence: `mobile/src/app/loans.tsx`, `backend/src/services/loans.service.ts`
## Budget
### budget.plan
- Status: PARITY
- Severity: P1
- Evidence: `mobile/src/app/(tabs)/budget.tsx`, `frontend/src/pages/dashboard/BudgetPage.tsx`, `backend/src/schemas/budget.schema.ts`
## Reports
### reports.analytics
- Status: PARITY
- Severity: P2
- Evidence: `mobile/src/app/(tabs)/reports.tsx`, `frontend/src/pages/dashboard/ReportsPage.tsx`, `backend/src/services/analytics.service.ts`
## OCR
### ocr.receipt
- Status: PARTIAL
- Severity: P2
- Evidence: `mobile/src/app/(tabs)/ocr.tsx`, `frontend/src/pages/dashboard/OcrScannerPage.tsx`, `backend/src/services/receipt-ocr.service.ts`
## AI Assistant
### ai.assistant
- Status: PARITY
- Severity: P2
- Evidence: `mobile/src/services/api.ts`, `frontend/src/pages/dashboard/AiAssistantPage.tsx`, `backend/src/services/ai.service.ts`
## Notifications
### notifications.reminders
- Status: PARTIAL
- Severity: P2
- Evidence: `mobile/src/services/financial-reminders.ts`, `backend/src/services/notification-scheduler.service.ts`, `frontend/src/hooks/useNotificationPreferences.ts`
## Financial contracts
- **income.wallet** — Income deposits into the selected wallet through the backend income contract. Evidence: `backend/src/schemas/income.schema.ts`.
- **expense.wallet** — Expenses carry an owned wallet ID and are included in wallet recomputation. Evidence: `backend/src/schemas/expense.schema.ts`.
- **transfer.fee** — Transfer principal stays outside income/spending; only the fee becomes an expense. Evidence: `backend/src/services/wallets.service.ts`.
- **goal.contribution** — Goal contributions use the atomic goal contribution RPC and do not create income or expense. Evidence: `backend/src/controllers/resource.controller.ts`.
- **loan.interest** — Only loan interest is recorded in income or expenses. Evidence: `backend/src/services/loans.service.ts`.