import { randomUUID } from "crypto";
import { asNumber, client, monthRange, previousMonthRange, requireUserId, throwIfError, todayIso } from "./db.js";

const budgetColors = ["#e8775d", "#6fa3d2", "#7db59c", "#f2c87c", "#9d90ac", "#bdb2a5", "#0f8a6b"];

type BudgetCategoryInput = {
  id: string;
  name: string;
  budget: number;
  auto_distribute?: boolean;
  last_distributed_month?: string | null;
  last_distributed_amount?: number;
};

type SaveBudgetOptions = {
  autoDistributeSavings?: boolean;
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

function addCategoryLabel(target: Map<string, string>, category: string) {
  const key = normalizeCategoryKey(category);
  const name = category.trim();

  if (!key || !name || target.has(key)) {
    return;
  }

  target.set(key, name);
}

function normalizeBudgetCategories(value: unknown): BudgetCategoryInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): BudgetCategoryInput | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const category = item as {
        id?: unknown;
        name?: unknown;
        budget?: unknown;
        auto_distribute?: unknown;
        last_distributed_month?: unknown;
        last_distributed_amount?: unknown;
      };
      const name = typeof category.name === "string" ? category.name.trim() : "";

      if (!name) {
        return null;
      }

      return {
        id: typeof category.id === "string" && category.id.trim() ? category.id.trim() : randomUUID(),
        name,
        budget: asNumber(category.budget),
        auto_distribute: Boolean(category.auto_distribute),
        last_distributed_month: typeof category.last_distributed_month === "string" ? category.last_distributed_month : null,
        last_distributed_amount: asNumber(category.last_distributed_amount),
      };
    })
    .filter((item): item is BudgetCategoryInput => Boolean(item));
}

function isSavingsCategory(category: BudgetCategoryInput) {
  return category.id === "savings" || /savings/i.test(category.name);
}

function monthsUntil(deadline: string) {
  const targetDate = new Date(`${deadline}T00:00:00`);
  const today = new Date();
  const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / 86400000);

  return Math.max(1, Math.ceil(diffDays / 30));
}

function currentMonthKey() {
  return monthRange().start.slice(0, 7);
}

async function distributeSavingsAllocation(userId: string, amount: number) {
  const allocationCents = Math.max(0, Math.round(amount * 100));

  if (!allocationCents) {
    return 0;
  }

  const { data, error } = await client()
    .from("savings_goals")
    .select("*")
    .eq("user_id", requireUserId(userId))
    .is("deleted_at", null)
    .is("completed_at", null);
  throwIfError(error);

  const activeGoals = (data ?? [])
    .map((goal) => {
      const currentAmount = asNumber(goal.current_amount);
      const targetAmount = asNumber(goal.target_amount);
      const remaining = Math.max(0, targetAmount - currentAmount);
      const monthlyNeed = remaining / monthsUntil(String(goal.deadline));

      return {
        id: String(goal.id),
        currentAmount,
        targetAmount,
        deadline: String(goal.deadline),
        remainingCents: Math.round(remaining * 100),
        weight: monthlyNeed > 0 ? monthlyNeed : remaining,
      };
    })
    .filter((goal) => goal.remainingCents > 0)
    .sort((left, right) => left.deadline.localeCompare(right.deadline));

  if (!activeGoals.length) {
    return 0;
  }

  const totalWeight = activeGoals.reduce((sum, goal) => sum + goal.weight, 0) || activeGoals.length;
  const allocations = activeGoals.map((goal) => ({
    ...goal,
    allocationCents: Math.min(
      goal.remainingCents,
      Math.floor((allocationCents * (totalWeight ? goal.weight : 1)) / totalWeight),
    ),
  }));
  let allocatedCents = allocations.reduce((sum, goal) => sum + goal.allocationCents, 0);

  while (allocatedCents < allocationCents) {
    const nextGoal = allocations.find((goal) => goal.allocationCents < goal.remainingCents);

    if (!nextGoal) {
      break;
    }

    nextGoal.allocationCents += 1;
    allocatedCents += 1;
  }

  const updateResults = await Promise.all(
    allocations
      .filter((goal) => goal.allocationCents > 0)
      .map((goal) => {
        const nextAmount = Math.min(goal.targetAmount, goal.currentAmount + goal.allocationCents / 100);

        return client()
          .from("savings_goals")
          .update({
            current_amount: nextAmount,
            completed_at: nextAmount >= goal.targetAmount ? new Date().toISOString() : null,
          })
          .eq("user_id", requireUserId(userId))
          .eq("id", goal.id);
      }),
  );

  for (const result of updateResults) {
    throwIfError(result.error);
  }

  return allocatedCents / 100;
}

async function getBudgetPlan(userId: string) {
  const { data, error } = await client().from("budget_plans").select("*").eq("user_id", requireUserId(userId)).maybeSingle();
  throwIfError(error);
  return data ?? null;
}

export async function saveBudgetPlan(userId: string, categories: BudgetCategoryInput[], options: SaveBudgetOptions = {}) {
  const currentMonth = currentMonthKey();
  let sanitizedCategories = categories
    .map((category) => ({
      id: category.id || randomUUID(),
      name: category.name.trim(),
      budget: asNumber(category.budget),
      auto_distribute: Boolean(category.auto_distribute),
      last_distributed_month: category.last_distributed_month ?? null,
      last_distributed_amount: asNumber(category.last_distributed_amount),
    }))
    .filter((category) => category.name.length > 0);

  const savingsCategory = sanitizedCategories.find(isSavingsCategory);
  const shouldAutoDistribute = Boolean(options.autoDistributeSavings && savingsCategory);
  let amountToDistribute = 0;

  if (savingsCategory && shouldAutoDistribute) {
    const alreadyAppliedThisMonth = savingsCategory.last_distributed_month === currentMonth
      ? asNumber(savingsCategory.last_distributed_amount)
      : 0;
    amountToDistribute = Math.max(0, savingsCategory.budget - alreadyAppliedThisMonth);
  }

  const { error } = await client()
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

  if (savingsCategory && shouldAutoDistribute && amountToDistribute > 0) {
    const distributedAmount = await distributeSavingsAllocation(userId, amountToDistribute);

    sanitizedCategories = sanitizedCategories.map((category) => {
      if (!isSavingsCategory(category)) {
        return category;
      }

      return {
        ...category,
        auto_distribute: true,
        last_distributed_month: currentMonth,
        last_distributed_amount: (category.last_distributed_month === currentMonth ? asNumber(category.last_distributed_amount) : 0) + distributedAmount,
      };
    });

    const { error: updateError } = await client()
      .from("budget_plans")
      .upsert(
        {
          user_id: requireUserId(userId),
          categories: sanitizedCategories,
        },
        { onConflict: "user_id" },
      );
    throwIfError(updateError);
  }

  return getBudgetSummary(userId);
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
  const savingsCategory = categoriesData.find(isSavingsCategory);
  const totalBudget = categoriesData.reduce((sum, item) => sum + item.budget, 0);
  const categoryTotals = new Map<string, number>();
  const categoryLabels = new Map<string, string>();

  for (const expense of expenses) {
    const category = String(expense.category || "");
    addCategoryAmount(categoryTotals, category, asNumber(expense.amount));
    addCategoryLabel(categoryLabels, category);
  }

  for (const bill of bills) {
    const category = String(bill.category || "");
    addCategoryAmount(categoryTotals, category, asNumber(bill.amount));
    addCategoryLabel(categoryLabels, category);
  }

  for (const subscription of subscriptionsData) {
    addCategoryAmount(categoryTotals, "Subscriptions", monthlySubscriptionAmount(subscription));
    addCategoryLabel(categoryLabels, "Subscriptions");
  }

  const totalSpent = Array.from(categoryTotals.values()).reduce((sum, amount) => sum + amount, 0);
  const categories = categoriesData.map((target, index) => {
    const spent = categoryTotals.get(normalizeCategoryKey(target.name)) ?? 0;
    const goal = isSavingsCategory(target);

    return {
      ...target,
      spent: goal ? 0 : spent,
      percent: target.budget ? Math.round(((goal ? 0 : spent) / target.budget) * 100) : 0,
      color: budgetColors[index % budgetColors.length],
      goal,
    };
  });

  const plannedCategoryKeys = new Set(categoriesData.map((category) => normalizeCategoryKey(category.name)).filter(Boolean));

  for (const [key, spent] of categoryTotals.entries()) {
    if (plannedCategoryKeys.has(key) || key === "savings") {
      continue;
    }

    categories.push({
      id: `unplanned-${key}`,
      name: categoryLabels.get(key) ?? key,
      budget: 0,
      spent,
      percent: spent > 0 ? 100 : 0,
      color: budgetColors[categories.length % budgetColors.length],
      goal: false,
    });
  }

  return {
    month: range.start.slice(0, 7),
    total_budget: totalBudget,
    total_spent: totalSpent,
    remaining: Math.max(0, totalBudget - totalSpent),
    used_percent: totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0,
    suggested_savings_move: Math.max(0, Math.round(totalBudget * 0.1)),
    savings_allocation: savingsCategory?.budget ?? 0,
    savings_auto_distribute: Boolean(savingsCategory?.auto_distribute),
    savings_last_distributed_month: savingsCategory?.last_distributed_month ?? null,
    savings_last_distributed_amount: savingsCategory?.last_distributed_amount ?? 0,
    savings_distributed_this_month: savingsCategory?.last_distributed_month === range.start.slice(0, 7),
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
