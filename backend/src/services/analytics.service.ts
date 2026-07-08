import { randomUUID } from "crypto";
import { asNumber, client, monthRange, previousMonthRange, requireUserId, throwIfError, todayIso } from "./db.js";

const budgetColors = ["#e8775d", "#6fa3d2", "#7db59c", "#f2c87c", "#9d90ac", "#bdb2a5", "#0f8a6b"];

type BudgetCategoryInput = {
  id: string;
  name: string;
  budget: number;
};

function normalizeCategoryKey(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  if (normalized.includes("transport") || normalized.includes("commut") || normalized.includes("travel")) {
    return "transport";
  }

  if (normalized.includes("utilit")) {
    return "utilities";
  }

  if (normalized.includes("subscript") || normalized.includes("membership")) {
    return "subscriptions";
  }

  if (normalized.includes("savings")) {
    return "savings";
  }

  return normalized.replace(/[^a-z0-9]+/g, "");
}

function addCategoryAmount(target: Map<string, number>, category: string, amount: number) {
  const key = normalizeCategoryKey(category);

  if (!key) {
    return;
  }

  target.set(key, (target.get(key) ?? 0) + amount);
}

function normalizeBudgetCategories(value: unknown): BudgetCategoryInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const category = item as { id?: unknown; name?: unknown; budget?: unknown };
      const name = typeof category.name === "string" ? category.name.trim() : "";

      if (!name) {
        return null;
      }

      return {
        id: typeof category.id === "string" && category.id.trim() ? category.id.trim() : randomUUID(),
        name,
        budget: asNumber(category.budget),
      };
    })
    .filter((item): item is BudgetCategoryInput => Boolean(item));
}

async function getBudgetPlan(userId: string) {
  const { data, error } = await client().from("budget_plans").select("*").eq("user_id", requireUserId(userId)).maybeSingle();
  throwIfError(error);
  return data ?? null;
}

export async function saveBudgetPlan(userId: string, categories: BudgetCategoryInput[]) {
  const sanitizedCategories = categories
    .map((category) => ({
      id: category.id || randomUUID(),
      name: category.name.trim(),
      budget: asNumber(category.budget),
    }))
    .filter((category) => category.name.length > 0);

  const { data, error } = await client()
    .from("budget_plans")
    .upsert(
      {
        user_id: requireUserId(userId),
        categories: sanitizedCategories,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  throwIfError(error);
  return data;
}

async function rowsFor(table: string, userId: string, dateColumn: string, from: string, to: string) {
  const { data, error } = await client().from(table).select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null).gte(dateColumn, from).lte(dateColumn, to);
  throwIfError(error);
  return data ?? [];
}

function monthlySubscriptionAmount(subscription: { amount: unknown; billing_cycle?: unknown }) {
  const amount = asNumber(subscription.amount);
  return subscription.billing_cycle === "yearly" ? amount / 12 : amount;
}

export async function getBudgetSummary(userId: string) {
  const range = monthRange();
  const plan = await getBudgetPlan(userId);

  if (!plan) {
    return null;
  }

  const [expenses, bills, subscriptions] = await Promise.all([
    rowsFor("expenses", userId, "date", range.start, range.end),
    rowsFor("bills", userId, "due_date", range.start, range.end),
    client().from("subscriptions").select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null),
  ]);

  const subscriptionsData = "data" in subscriptions ? subscriptions.data ?? [] : [];
  if ("error" in subscriptions) throwIfError(subscriptions.error);

  const categoriesData = normalizeBudgetCategories(plan.categories);
  const totalBudget = categoriesData.reduce((sum, item) => sum + item.budget, 0);
  const categoryTotals = new Map<string, number>();

  for (const expense of expenses) {
    addCategoryAmount(categoryTotals, String(expense.category || ""), asNumber(expense.amount));
  }

  for (const bill of bills) {
    addCategoryAmount(categoryTotals, String(bill.category || ""), asNumber(bill.amount));
  }

  for (const subscription of subscriptionsData) {
    addCategoryAmount(categoryTotals, "Subscriptions", monthlySubscriptionAmount(subscription));
  }

  const totalSpent = Array.from(categoryTotals.values()).reduce((sum, amount) => sum + amount, 0);
  const categories = categoriesData.map((target, index) => {
    const spent = categoryTotals.get(normalizeCategoryKey(target.name)) ?? 0;
    const goal = target.id === "savings" || /savings/i.test(target.name);

    return {
      ...target,
      spent: goal ? 0 : spent,
      percent: target.budget ? Math.round(((goal ? 0 : spent) / target.budget) * 100) : 0,
      color: budgetColors[index % budgetColors.length],
      goal,
    };
  });

  return {
    month: range.start.slice(0, 7),
    total_budget: totalBudget,
    total_spent: totalSpent,
    remaining: Math.max(0, totalBudget - totalSpent),
    used_percent: totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0,
    suggested_savings_move: Math.max(0, Math.round(totalBudget * 0.1)),
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
  const localMonthlySubscriptionCost = subscriptionsData.reduce((sum, item) => sum + monthlySubscriptionAmount(item), 0);
  const subscriptionRatio = monthlyExpenses ? localMonthlySubscriptionCost / monthlyExpenses : 0;
  const subscriptionScore = Math.max(0, 20 - subscriptionRatio * 20);
  const budget = await getBudgetSummary(userId);
  const budgetScore = budget ? Math.max(0, 20 - Math.max(0, budget.used_percent - 100)) : 10;

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
