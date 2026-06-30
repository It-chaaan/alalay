export type Bill = {
  id: string;
  title: string;
  amount: number | string;
  category: string;
  due_date: string;
  recurring: boolean;
  frequency: string | null;
  status: "unpaid" | "paid" | "overdue";
  paid_at: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  amount: number | string;
  category: string;
  merchant: string;
  date: string;
  payment_method: string;
  created_at: string;
};

export type IncomeEntry = {
  id: string;
  source: string;
  type: "salary" | "freelance" | "business" | "remittance" | "other";
  amount: number | string;
  date: string;
  is_recurring: boolean;
  created_at: string;
};

export type Subscription = {
  id: string;
  name: string;
  logo_url: string | null;
  amount: number | string;
  renewal_date: string;
  billing_cycle: "monthly" | "yearly";
  auto_renew: boolean;
  last_used_at: string | null;
};

export type SavingsGoal = {
  id: string;
  title: string;
  emoji: string;
  target_amount: number | string;
  current_amount: number | string;
  monthly_target: number | string;
  deadline: string;
  completed_at: string | null;
};

export type BudgetSummary = {
  month: string;
  total_budget: number;
  total_spent: number;
  remaining: number;
  used_percent: number;
  suggested_savings_move: number;
  categories: Array<{ id: string; name: string; budget: number; spent: number; percent: number; color: string; goal?: boolean }>;
};

export type ReportsSummary = {
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  daily_spending: Array<{ date: string; amount: number }>;
  categories: Array<{ name: string; amount: number }>;
};

export type DashboardSummary = {
  total_bills_this_month: number;
  bills_due_this_week: number;
  monthly_expenses: number;
  monthly_expenses_delta_percent: number;
  savings_progress_percent: number;
  savings_current: number;
  savings_target: number;
  health_score: number;
  weekly_bills: Bill[];
  recent_activity: Expense[];
  monthly_spending: Array<{ month: string; value: number }>;
  ai_insight: { status: string; message: string };
};

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  currency: string;
  language: "en" | "fil";
  plan: string;
  income: number | string;
  pay_schedule: string;
};
