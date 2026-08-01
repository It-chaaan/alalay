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
  notes?: string | null;
  attachment_url?: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  amount: number | string;
  category: string;
  merchant: string;
  date: string;
  payment_method: string;
  receipt_url?: string | null;
  ocr_raw?: Record<string, unknown> | null;
  is_split?: boolean;
  split_with?: string[];
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

export type SavingsDashboard = {
  overview: {
    totalSavings: number;
    goalSavings: number;
    generalSavings: number;
    activeGoals: number;
    completedGoals: number;
    monthlyContribution: number;
    savingsRate: number;
  };
  breakdown: Array<{
    key: string;
    label: string;
    amount: number;
    description: string;
  }>;
  futureSavingsTypes: string[];
  allocation: {
    monthly_savings_budget: number;
    goal_allocation_total: number;
    general_savings: number;
    unallocated_savings: number;
    goal_allocations: Array<{ goal_id: string; title: string; amount: number; progress_percent: number }>;
    remaining_savings_behavior: "auto_general" | "leave_unallocated" | "ask_monthly";
    remaining_savings_label: string;
  };
  aiInsight: {
    status: string;
    message: string;
  };
  goals: SavingsGoal[];
};

export type BudgetSummary = {
  month: string;
  monthly_income: number;
  budget_amount: number;
  spent_amount: number;
  remaining_budget: number;
  saved_amount: number;
  unallocated_income: number;
  budget_health: {
    income: number;
    budgeted_percent: number;
    spent_percent: number;
    saved_percent: number;
    remaining_percent: number;
    unallocated_percent: number;
  };
  savings_allocation_summary: {
    monthly_savings_budget: number;
    goal_allocation_total: number;
    general_savings: number;
    unallocated_savings: number;
    goal_allocations: Array<{
      goal_id: string;
      title: string;
      amount: number;
      progress_percent: number;
    }>;
    remaining_savings_behavior: "auto_general" | "leave_unallocated" | "ask_monthly";
    remaining_savings_label: string;
  };
  total_budget: number;
  total_spent: number;
  remaining: number;
  used_percent: number;
  suggested_savings_move: number;
  monthly_savings_budget: number;
  goal_allocation_total: number;
  general_savings: number;
  unallocated_savings: number;
  remaining_savings_behavior: "auto_general" | "leave_unallocated" | "ask_monthly";
  remaining_savings_label: string;
  goal_allocations: Array<{
    goal_id: string;
    title: string;
    amount: number;
    progress_percent: number;
  }>;
  savings_allocation: number;
  savings_auto_distribute: boolean;
  savings_last_distributed_month: string | null;
  savings_last_distributed_amount: number;
  savings_distributed_this_month: boolean;
  categories: Array<{
    id: string;
    name: string;
    budget: number;
    spent: number;
    percent: number;
    color: string;
    goal?: boolean;
    auto_distribute?: boolean;
    last_distributed_month?: string | null;
    last_distributed_amount?: number;
  }>;
};

export type ReportPeriod = "this_month" | "last_month" | "last_3_months" | "quarter" | "ytd" | "custom";

export type ReportsSummary = {
  range: {
    period: ReportPeriod;
    start: string;
    end: string;
    label: string;
    days: number;
    budgetMonths: number;
  };
  profile: {
    currency: string;
    configured_income: number;
    pay_schedule: string;
  };
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  budget_utilization: number;
  remaining_budget: number;
  total_bills_paid: number;
  outstanding_bills: number;
  subscription_spending: number;
  savings_contributions: number;
  average_daily_spending: number;
  average_weekly_spending: number;
  average_monthly_spending: number;
  highest_spending_category: { name: string; amount: number; percent: number } | null;
  lowest_spending_category: { name: string; amount: number; percent: number } | null;
  monthly_trend: Array<{ month: string; income: number; expenses: number; net: number }>;
  daily_spending: Array<{ date: string; amount: number }>;
  categories: Array<{ name: string; amount: number; percent: number }>;
  budget: {
    total_budget: number;
    spent: number;
    remaining: number;
    utilization_percent: number;
    monthly_savings_budget: number;
    goal_allocation_total: number;
    general_savings: number;
    unallocated_savings: number;
    goal_allocations: Array<{ goal_id: string; title: string; amount: number; progress_percent: number }>;
    remaining_savings_behavior: "auto_general" | "leave_unallocated" | "ask_monthly";
    remaining_savings_label: string;
    monthly_savings_allocation: number;
    savings_allocation_usage: number;
    over_budget_categories: Array<{ id: string; name: string; budget: number; spent: number; remaining: number; percent: number; color: string; goal?: boolean }>;
    under_budget_categories: Array<{ id: string; name: string; budget: number; spent: number; remaining: number; percent: number; color: string; goal?: boolean }>;
    categories: Array<{ id: string; name: string; budget: number; spent: number; remaining: number; percent: number; color: string; goal?: boolean }>;
  };
  savings: {
    total_saved: number;
    total_goal_savings: number;
    general_savings: number;
    monthly_savings_budget: number;
    active_goals: number;
    completed_goals: number;
    goal_progress: number;
    monthly_contributions: number;
    contribution_history: Array<{ date: string; amount: number; goal: string }>;
    savings_allocation_history: Array<{ month: string; goal_allocation: number; general_savings: number; unallocated_savings: number }>;
    goal_contribution_history: Array<{ date: string; amount: number; goal: string }>;
    projected_completion: Array<{ id: string; title: string; projected_date: string; progress_percent: number }>;
    distribution: Array<{ name: string; amount: number; target: number }>;
  };
  charts: {
    daily_spending: Array<{ date: string; amount: number }>;
    monthly_spending: Array<{ month: string; amount: number }>;
    income_vs_expense: Array<{ month: string; income: number; expenses: number }>;
    budget_vs_actual: Array<{ name: string; budget: number; actual: number }>;
    savings_growth: Array<{ name: string; current: number; target: number }>;
    category_distribution: Array<{ name: string; amount: number; percent: number }>;
    bills_timeline: Array<{ date: string; amount: number; label: string; status: string }>;
    subscriptions_timeline: Array<{ date: string; amount: number; label: string }>;
  };
  data_sources: {
    income: number;
    expenses: number;
    bills: number;
    subscriptions: number;
    savings_goals: number;
    budget_categories: number;
    ocr_expenses: number;
    ai_insights: number;
  };
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
  monthly_spending: Array<{ month: string; value: number; current?: boolean }>;
  ai_insight: { status: string; message: string };
};

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone?: string | null;
  currency: string;
  language: "en" | "fil";
  plan: string;
  income: number | string;
  pay_schedule: string;
};
