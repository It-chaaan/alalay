import { asNumber, client, monthRange, previousMonthRange, requireUserId, throwIfError, todayIso } from "./db.js";

const budgetTargets = [
  { id: "food", name: "Food", budget: 7000, color: "#e8775d" },
  { id: "transport", name: "Transport", budget: 2000, color: "#6fa3d2" },
  { id: "utilities", name: "Utilities", budget: 4500, color: "#7db59c" },
  { id: "subscriptions", name: "Subscriptions", budget: 1500, color: "#f2c87c" },
  { id: "health", name: "Health", budget: 1000, color: "#9d90ac" },
  { id: "others", name: "Others", budget: 1000, color: "#bdb2a5" },
  { id: "savings", name: "Savings allocation", budget: 0, color: "#0f8a6b", goal: true },
];

async function rowsFor(table: string, userId: string, dateColumn: string, from: string, to: string) {
  const { data, error } = await client().from(table).select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null).gte(dateColumn, from).lte(dateColumn, to);
  throwIfError(error);
  return data ?? [];
}

export async function getBudgetSummary(userId: string) {
  const range = monthRange();
  const expenses = await rowsFor("expenses", userId, "date", range.start, range.end);
  const totalBudget = budgetTargets.reduce((sum, item) => sum + item.budget, 0);
  const totalSpent = expenses.reduce((sum, item) => sum + asNumber(item.amount), 0);
  const categories = budgetTargets.map((target) => {
    const spent = target.goal ? 0 : expenses.filter((expense) => String(expense.category).toLowerCase() === target.name.toLowerCase()).reduce((sum, item) => sum + asNumber(item.amount), 0);
    return { ...target, spent, percent: target.budget ? Math.round((spent / target.budget) * 100) : 0 };
  });

  return {
    month: "Current month",
    total_budget: totalBudget,
    total_spent: totalSpent,
    remaining: Math.max(0, totalBudget - totalSpent),
    used_percent: totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0,
    suggested_savings_move: 500,
    categories,
  };
}

export async function getReports(userId: string) {
  const range = monthRange();
  const expenses = await rowsFor("expenses", userId, "date", range.start, range.end);
  const income = await rowsFor("income", userId, "date", range.start, range.end);
  const totalExpenses = expenses.reduce((sum, item) => sum + asNumber(item.amount), 0);
  const totalIncome = income.reduce((sum, item) => sum + asNumber(item.amount), 0);
  const byCategory = new Map<string, number>();
  const daily = new Map<string, number>();

  for (const expense of expenses) {
    const category = String(expense.category || "Others");
    byCategory.set(category, (byCategory.get(category) ?? 0) + asNumber(expense.amount));
    daily.set(expense.date, (daily.get(expense.date) ?? 0) + asNumber(expense.amount));
  }

  return {
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_savings: totalIncome - totalExpenses,
    savings_rate: totalIncome ? Number((((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(1)) : 0,
    daily_spending: Array.from(daily.entries()).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date)),
    categories: Array.from(byCategory.entries()).map(([name, amount]) => ({ name, amount })),
  };
}

export async function getDashboardSummary(userId: string) {
  const current = monthRange();
  const previous = previousMonthRange();
  const [bills, expenses, previousExpenses, goals, subscriptions] = await Promise.all([
    rowsFor("bills", userId, "due_date", current.start, current.end),
    rowsFor("expenses", userId, "date", current.start, current.end),
    rowsFor("expenses", userId, "date", previous.start, previous.end),
    client().from("savings_goals").select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null),
    client().from("subscriptions").select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null),
  ]);

  const goalsData = "data" in goals ? goals.data ?? [] : [];
  const subscriptionsData = "data" in subscriptions ? subscriptions.data ?? [] : [];
  if ("error" in goals) throwIfError(goals.error);
  if ("error" in subscriptions) throwIfError(subscriptions.error);

  const monthlyExpenses = expenses.reduce((sum, item) => sum + asNumber(item.amount), 0);
  const previousTotal = previousExpenses.reduce((sum, item) => sum + asNumber(item.amount), 0);
  const savingsTarget = goalsData.reduce((sum, item) => sum + asNumber(item.target_amount), 0);
  const savingsCurrent = goalsData.reduce((sum, item) => sum + asNumber(item.current_amount), 0);
  const onTimeBills = bills.filter((bill) => bill.status === "paid" || bill.due_date >= todayIso()).length;
  const billScore = bills.length ? (onTimeBills / bills.length) * 35 : 35;
  const savingsRateScore = savingsTarget ? Math.min(25, (savingsCurrent / savingsTarget) * 25) : 10;
  const subscriptionRatio = monthlyExpenses ? subscriptionsData.reduce((sum, item) => sum + asNumber(item.amount), 0) / monthlyExpenses : 0;
  const subscriptionScore = Math.max(0, 20 - subscriptionRatio * 20);
  const budget = await getBudgetSummary(userId);
  const budgetScore = Math.max(0, 20 - Math.max(0, budget.used_percent - 100));

  return {
    total_bills_this_month: bills.reduce((sum, item) => sum + asNumber(item.amount), 0),
    bills_due_this_week: bills.filter((bill) => bill.due_date >= todayIso() && bill.due_date <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)).reduce((sum, item) => sum + asNumber(item.amount), 0),
    monthly_expenses: monthlyExpenses,
    monthly_expenses_delta_percent: previousTotal ? Math.round(((monthlyExpenses - previousTotal) / previousTotal) * 100) : 0,
    savings_progress_percent: savingsTarget ? Math.round((savingsCurrent / savingsTarget) * 100) : 0,
    savings_current: savingsCurrent,
    savings_target: savingsTarget,
    health_score: Math.round(billScore + savingsRateScore + subscriptionScore + budgetScore),
    weekly_bills: bills,
    recent_activity: expenses.slice(0, 5),
    monthly_spending: [{ month: "Current", value: monthlyExpenses }],
    ai_insight: {
      status: "not_configured",
      message: "AI insights are not configured yet.",
    },
  };
}
