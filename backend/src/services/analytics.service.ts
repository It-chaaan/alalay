import { randomUUID } from "crypto";
import { addDaysIso, asNumber, client, monthRange, previousMonthRange, requireUserId, throwIfError, todayIso } from "./db.js";
import { generateDashboardInsight } from "./dashboard-insight.service.js";

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
  remainingSavingsBehavior?: string;
};

type SavingsPreferenceBehavior = "auto_general" | "leave_unallocated" | "ask_monthly";

type SavingsGoalAllocation = {
  goal_id: string;
  title: string;
  amount: number;
  progress_percent: number;
};

export type ReportPeriod = "this_month" | "last_month" | "last_3_months" | "quarter" | "ytd" | "custom";

type ReportOptions = {
  period?: string;
  from?: string;
  to?: string;
};

type BudgetSummaryOptions = {
  month?: string;
};

type ReportRange = {
  period: ReportPeriod;
  start: string;
  end: string;
  label: string;
  days: number;
  budgetMonths: number;
};

type SpendingEntry = {
  date: string;
  amount: number;
  category: string;
  source: "expense" | "bill" | "subscription";
  label: string;
  status?: string;
};

const reportCache = new Map<string, { expiresAt: number; data: unknown }>();
const reportCacheTtlMs = 15_000;
const defaultSavingsPreferenceBehavior: SavingsPreferenceBehavior = "auto_general";

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

function normalizeSavingsPreference(value: unknown): SavingsPreferenceBehavior {
  return value === "leave_unallocated" || value === "ask_monthly" || value === "auto_general"
    ? value
    : defaultSavingsPreferenceBehavior;
}

function getSavingsPreferenceLabel(value: SavingsPreferenceBehavior) {
  if (value === "leave_unallocated") {
    return "Leave remaining savings unallocated";
  }

  if (value === "ask_monthly") {
    return "Ask every month";
  }

  return "Automatically move remaining savings into General Savings";
}

function toDateOnlyIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, (month || 1) - 1, day || 1);
}

function isDateOnly(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const originalDay = next.getDate();

  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  next.setDate(Math.min(originalDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));

  return next;
}

function diffDaysInclusive(start: string, end: string) {
  return Math.max(1, Math.floor((parseDateOnly(end).getTime() - parseDateOnly(start).getTime()) / 86400000) + 1);
}

function monthKeysBetween(start: string, end: string) {
  const keys: string[] = [];
  const cursor = new Date(parseDateOnly(start).getFullYear(), parseDateOnly(start).getMonth(), 1);
  const last = new Date(parseDateOnly(end).getFullYear(), parseDateOnly(end).getMonth(), 1);

  while (cursor <= last) {
    keys.push(toDateOnlyIso(cursor).slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
}

function getReportRange(options: ReportOptions = {}): ReportRange {
  const today = new Date();
  const requestedPeriod = options.period === "last_month" || options.period === "last_3_months" || options.period === "quarter" || options.period === "ytd" || options.period === "custom"
    ? options.period
    : "this_month";
  let start: string;
  let end: string;
  let period: ReportPeriod = requestedPeriod;

  if (requestedPeriod === "custom" && isDateOnly(options.from) && isDateOnly(options.to)) {
    start = options.from!;
    end = options.to!;

    if (start > end) {
      [start, end] = [end, start];
    }
  } else if (requestedPeriod === "last_month") {
    const range = previousMonthRange(today);
    start = range.start;
    end = range.end;
  } else if (requestedPeriod === "last_3_months") {
    const startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    start = toDateOnlyIso(startDate);
    end = toDateOnlyIso(endDate);
  } else if (requestedPeriod === "quarter") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    const startDate = new Date(today.getFullYear(), quarterStartMonth, 1);
    const endDate = new Date(today.getFullYear(), quarterStartMonth + 3, 0);
    start = toDateOnlyIso(startDate);
    end = toDateOnlyIso(endDate);
  } else if (requestedPeriod === "ytd") {
    start = toDateOnlyIso(new Date(today.getFullYear(), 0, 1));
    end = toDateOnlyIso(today);
  } else {
    const range = monthRange(today);
    period = "this_month";
    start = range.start;
    end = range.end;
  }

  const formatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
  const startLabel = formatter.format(parseDateOnly(start));
  const endLabel = formatter.format(parseDateOnly(end));

  return {
    period,
    start,
    end,
    label: start === end ? startLabel : `${startLabel} - ${endLabel}`,
    days: diffDaysInclusive(start, end),
    budgetMonths: Math.max(1, monthKeysBetween(start, end).length),
  };
}

function addAmountByDate(target: Map<string, number>, date: string, amount: number) {
  target.set(date, (target.get(date) ?? 0) + amount);
}

function addAmountByMonth(target: Map<string, number>, date: string, amount: number) {
  const month = date.slice(0, 7);
  target.set(month, (target.get(month) ?? 0) + amount);
}

function sortedSeries(map: Map<string, number>, keys?: string[]) {
  const entries = keys ? keys.map((key) => [key, map.get(key) ?? 0] as const) : Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right));

  return entries.map(([date, amount]) => ({ date, amount: Number(amount.toFixed(2)) }));
}

function getDateFromTimestamp(value: unknown, fallback: string) {
  return typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : fallback;
}

function getSubscriptionOccurrences(subscription: { renewal_date?: unknown; billing_cycle?: unknown; amount?: unknown; name?: unknown }, range: Pick<ReportRange, "start" | "end">): SpendingEntry[] {
  if (typeof subscription.renewal_date !== "string" || !isDateOnly(subscription.renewal_date)) {
    return [];
  }

  const start = parseDateOnly(range.start);
  const end = parseDateOnly(range.end);
  const stepMonths = subscription.billing_cycle === "yearly" ? 12 : 1;
  let occurrence = parseDateOnly(subscription.renewal_date);
  const entries: SpendingEntry[] = [];

  while (occurrence < start) {
    occurrence = addMonths(occurrence, stepMonths);
  }

  while (occurrence <= end) {
    const date = toDateOnlyIso(occurrence);
    entries.push({
      date,
      amount: asNumber(subscription.amount),
      category: "Subscriptions",
      source: "subscription",
      label: String(subscription.name || "Subscription"),
    });
    occurrence = addMonths(occurrence, stepMonths);
  }

  return entries;
}

function getBudgetRange(options: BudgetSummaryOptions = {}) {
  if (options.month && /^\d{4}-\d{2}$/.test(options.month)) {
    const [year, month] = options.month.split("-").map(Number);

    return monthRange(new Date(year, month - 1, 1));
  }

  return monthRange();
}

async function getSavingsPreference(userId: string) {
  const { data, error } = await client()
    .from("savings_preferences")
    .select("*")
    .eq("user_id", requireUserId(userId))
    .maybeSingle();

  if (error) {
    const message = error.message.toLowerCase();

    if (message.includes("savings_preferences") || message.includes("relation") || message.includes("schema cache")) {
      return {
        remaining_savings_behavior: defaultSavingsPreferenceBehavior,
        general_savings_label: "General Savings",
      };
    }

    throwIfError(error);
  }

  return {
    remaining_savings_behavior: normalizeSavingsPreference(data?.remaining_savings_behavior),
    general_savings_label: typeof data?.general_savings_label === "string" && data.general_savings_label.trim()
      ? data.general_savings_label.trim()
      : "General Savings",
  };
}

async function saveSavingsPreference(userId: string, remainingSavingsBehavior?: string) {
  if (!remainingSavingsBehavior) {
    return getSavingsPreference(userId);
  }

  const preference = normalizeSavingsPreference(remainingSavingsBehavior);
  const { data, error } = await client()
    .from("savings_preferences")
    .upsert(
      {
        user_id: requireUserId(userId),
        remaining_savings_behavior: preference,
        general_savings_label: "General Savings",
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error) {
    const message = error.message.toLowerCase();

    if (message.includes("savings_preferences") || message.includes("relation") || message.includes("schema cache")) {
      return {
        remaining_savings_behavior: preference,
        general_savings_label: "General Savings",
      };
    }

    throwIfError(error);
  }

  return {
    remaining_savings_behavior: normalizeSavingsPreference(data?.remaining_savings_behavior),
    general_savings_label: typeof data?.general_savings_label === "string" && data.general_savings_label.trim()
      ? data.general_savings_label.trim()
      : "General Savings",
  };
}

function calculateGoalAllocations(monthlySavingsBudget: number, autoDistribute: boolean, goals: Array<Record<string, unknown>>) {
  if (!autoDistribute || monthlySavingsBudget <= 0) {
    return [] as SavingsGoalAllocation[];
  }

  let remainingBudget = monthlySavingsBudget;
  const activeGoals = goals
    .map((goal) => {
      const currentAmount = asNumber(goal.current_amount);
      const targetAmount = asNumber(goal.target_amount);
      const remaining = Math.max(0, targetAmount - currentAmount);
      const monthlyTarget = asNumber(goal.monthly_target);

      return {
        id: String(goal.id),
        title: String(goal.title || "Savings goal"),
        deadline: String(goal.deadline || ""),
        currentAmount,
        targetAmount,
        remaining,
        plannedAmount: Math.max(0, monthlyTarget),
      };
    })
    .filter((goal) => goal.remaining > 0 && goal.plannedAmount > 0)
    .sort((left, right) => left.deadline.localeCompare(right.deadline));

  const allocations: SavingsGoalAllocation[] = [];

  for (const goal of activeGoals) {
    if (remainingBudget <= 0) {
      break;
    }

    const amount = Math.min(remainingBudget, goal.remaining, goal.plannedAmount);

    if (amount > 0) {
      allocations.push({
        goal_id: goal.id,
        title: goal.title,
        amount: Number(amount.toFixed(2)),
        progress_percent: goal.targetAmount ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0,
      });
      remainingBudget -= amount;
    }
  }

  return allocations;
}

function buildSavingsAllocationSummary(
  monthlySavingsBudget: number,
  autoDistribute: boolean,
  goals: Array<Record<string, unknown>>,
  remainingSavingsBehavior: SavingsPreferenceBehavior,
) {
  const goalAllocations = calculateGoalAllocations(monthlySavingsBudget, autoDistribute, goals);
  const goalAllocationTotal = goalAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const remainingSavings = Math.max(0, monthlySavingsBudget - goalAllocationTotal);
  const generalSavings = remainingSavingsBehavior === "auto_general" ? remainingSavings : 0;
  const unallocatedSavings = remainingSavingsBehavior === "auto_general" ? 0 : remainingSavings;

  return {
    monthly_savings_budget: Number(monthlySavingsBudget.toFixed(2)),
    goal_allocation_total: Number(goalAllocationTotal.toFixed(2)),
    general_savings: Number(generalSavings.toFixed(2)),
    unallocated_savings: Number(unallocatedSavings.toFixed(2)),
    goal_allocations: goalAllocations,
    remaining_savings_behavior: remainingSavingsBehavior,
    remaining_savings_label: getSavingsPreferenceLabel(remainingSavingsBehavior),
  };
}

async function getBudgetPlan(userId: string) {
  const { data, error } = await client().from("budget_plans").select("*").eq("user_id", requireUserId(userId)).maybeSingle();
  throwIfError(error);
  return data ?? null;
}

export async function saveBudgetPlan(userId: string, categories: BudgetCategoryInput[], options: SaveBudgetOptions = {}) {
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

  const { error } = await client()
    .from("budget_plans")
    .upsert(
      {
        user_id: requireUserId(userId),
        categories: sanitizedCategories.map((category) => isSavingsCategory(category)
          ? {
              ...category,
              name: category.name || "Monthly Savings Budget",
              auto_distribute: Boolean(options.autoDistributeSavings),
            }
          : category),
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  throwIfError(error);
  await saveSavingsPreference(userId, options.remainingSavingsBehavior);

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

export function buildMonthlySpending(expenses: Array<{ date: string; amount: unknown }>, now: Date) {
  const currentRange = monthRange(now);
  const cursor = new Date(`${currentRange.start}T12:00:00Z`);
  cursor.setUTCMonth(cursor.getUTCMonth() - 7, 1);

  return Array.from({ length: 8 }, (_, index) => {
    const range = monthRange(cursor);
    const monthKey = range.start.slice(0, 7);
    const value = expenses
      .filter((expense) => expense.date.slice(0, 7) === monthKey)
      .reduce((sum, expense) => sum + asNumber(expense.amount), 0);
    const label = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "Asia/Manila" }).format(cursor);
    const current = monthKey === currentRange.start.slice(0, 7);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);

    return { month: label, value, current };
  });
}

export async function getBudgetSummary(userId: string, options: BudgetSummaryOptions = {}) {
  const range = getBudgetRange(options);
  const plan = await getBudgetPlan(userId);

  if (!plan) {
    return null;
  }

  const [income, expenses, bills, subscriptions, savingsGoals, savingsPreference] = await Promise.all([
    rowsFor("income", userId, "date", range.start, range.end),
    rowsFor("expenses", userId, "date", range.start, range.end),
    rowsFor("bills", userId, "due_date", range.start, range.end),
    client().from("subscriptions").select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null),
    client().from("savings_goals").select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null),
    getSavingsPreference(userId),
  ]);

  const subscriptionsData = "data" in subscriptions ? subscriptions.data ?? [] : [];
  const savingsGoalsData = "data" in savingsGoals ? savingsGoals.data ?? [] : [];
  if ("error" in subscriptions) throwIfError(subscriptions.error);
  if ("error" in savingsGoals) throwIfError(savingsGoals.error);

  const categoriesData = normalizeBudgetCategories(plan.categories);
  const savingsCategory = categoriesData.find(isSavingsCategory);
  const monthlySavingsBudget = savingsCategory?.budget ?? 0;
  const savingsAllocation = buildSavingsAllocationSummary(
    monthlySavingsBudget,
    Boolean(savingsCategory?.auto_distribute),
    savingsGoalsData,
    savingsPreference.remaining_savings_behavior,
  );
  const totalBudget = categoriesData.reduce((sum, item) => sum + item.budget, 0);
  const categoryTotals = new Map<string, number>();
  const categoryLabels = new Map<string, string>();
  const paidBills = bills.filter((bill) => bill.status === "paid");
  const subscriptionCharges = subscriptionsData.flatMap((subscription) => getSubscriptionOccurrences(subscription, range));

  for (const expense of expenses) {
    const category = String(expense.category || "");
    addCategoryAmount(categoryTotals, category, asNumber(expense.amount));
    addCategoryLabel(categoryLabels, category);
  }

  for (const bill of paidBills) {
    const category = String(bill.category || "");
    addCategoryAmount(categoryTotals, category, asNumber(bill.amount));
    addCategoryLabel(categoryLabels, category);
  }

  for (const subscription of subscriptionCharges) {
    addCategoryAmount(categoryTotals, "Subscriptions", subscription.amount);
    addCategoryLabel(categoryLabels, "Subscriptions");
  }

  const monthlyIncome = income.reduce((sum, item) => sum + asNumber(item.amount), 0);
  const totalSpent = Array.from(categoryTotals.values()).reduce((sum, amount) => sum + amount, 0);
  const remainingBudget = totalBudget - totalSpent;
  const unallocatedIncome = monthlyIncome - totalBudget;
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
    monthly_income: monthlyIncome,
    budget_amount: totalBudget,
    spent_amount: totalSpent,
    remaining_budget: remainingBudget,
    saved_amount: savingsAllocation.monthly_savings_budget,
    unallocated_income: unallocatedIncome,
    budget_health: {
      income: monthlyIncome,
      budgeted_percent: monthlyIncome ? Math.round((totalBudget / monthlyIncome) * 100) : 0,
      spent_percent: monthlyIncome ? Math.round((totalSpent / monthlyIncome) * 100) : totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0,
      saved_percent: monthlyIncome ? Math.round((savingsAllocation.monthly_savings_budget / monthlyIncome) * 100) : 0,
      remaining_percent: totalBudget ? Math.round((Math.max(0, remainingBudget) / totalBudget) * 100) : 0,
      unallocated_percent: monthlyIncome ? Math.round((unallocatedIncome / monthlyIncome) * 100) : 0,
    },
    savings_allocation_summary: {
      monthly_savings_budget: savingsAllocation.monthly_savings_budget,
      goal_allocation_total: savingsAllocation.goal_allocation_total,
      general_savings: savingsAllocation.general_savings,
      unallocated_savings: savingsAllocation.unallocated_savings,
      goal_allocations: savingsAllocation.goal_allocations,
      remaining_savings_behavior: savingsAllocation.remaining_savings_behavior,
      remaining_savings_label: savingsAllocation.remaining_savings_label,
    },
    total_budget: totalBudget,
    total_spent: totalSpent,
    remaining: remainingBudget,
    used_percent: totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0,
    suggested_savings_move: Math.max(0, Math.round(totalBudget * 0.1)),
    monthly_savings_budget: savingsAllocation.monthly_savings_budget,
    goal_allocation_total: savingsAllocation.goal_allocation_total,
    general_savings: savingsAllocation.general_savings,
    unallocated_savings: savingsAllocation.unallocated_savings,
    goal_allocations: savingsAllocation.goal_allocations,
    remaining_savings_behavior: savingsAllocation.remaining_savings_behavior,
    remaining_savings_label: savingsAllocation.remaining_savings_label,
    savings_allocation: savingsAllocation.monthly_savings_budget,
    savings_auto_distribute: Boolean(savingsCategory?.auto_distribute),
    savings_last_distributed_month: savingsCategory?.last_distributed_month ?? null,
    savings_last_distributed_amount: savingsCategory?.last_distributed_amount ?? 0,
    savings_distributed_this_month: savingsCategory?.last_distributed_month === range.start.slice(0, 7),
    categories,
  };
}

export async function getSavingsDashboard(userId: string) {
  const [savingsGoals, plan, profile, savingsPreference] = await Promise.all([
    client().from("savings_goals").select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null),
    getBudgetPlan(userId),
    client().from("users").select("income,pay_schedule").eq("id", requireUserId(userId)).maybeSingle(),
    getSavingsPreference(userId),
  ]);

  const goals = "data" in savingsGoals ? savingsGoals.data ?? [] : [];
  const profileData = "data" in profile ? profile.data ?? null : null;
  if ("error" in savingsGoals) throwIfError(savingsGoals.error);
  if ("error" in profile) throwIfError(profile.error);

  const budgetCategories = normalizeBudgetCategories(plan?.categories);
  const savingsCategory = budgetCategories.find(isSavingsCategory);
  const monthlySavingsBudget = savingsCategory?.budget ?? 0;
  const savingsAllocation = buildSavingsAllocationSummary(
    monthlySavingsBudget,
    Boolean(savingsCategory?.auto_distribute),
    goals,
    savingsPreference.remaining_savings_behavior,
  );
  const goalSavings = goals.reduce((sum, goal) => sum + asNumber(goal.current_amount), 0);
  const activeGoals = goals.filter((goal) => !goal.completed_at && asNumber(goal.current_amount) < asNumber(goal.target_amount));
  const completedGoals = goals.filter((goal) => goal.completed_at || asNumber(goal.current_amount) >= asNumber(goal.target_amount));
  const monthlyContribution = monthlySavingsBudget || goals.reduce((sum, goal) => sum + asNumber(goal.monthly_target), 0);
  const generalSavings = savingsAllocation.general_savings;
  const totalSavings = goalSavings + generalSavings;
  const monthlyIncome = asNumber(profileData?.income);
  const savingsRate = monthlyIncome ? Math.round((monthlyContribution / monthlyIncome) * 100) : 0;
  const topGoalAllocation = savingsAllocation.goal_allocations[0];
  const aiInsight = topGoalAllocation
    ? `At your current savings plan, ${topGoalAllocation.title} receives ${Number(((topGoalAllocation.amount / Math.max(1, monthlyContribution)) * 100).toFixed(0))}% of this month's contribution.`
    : monthlyContribution > 0
      ? `You still have ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(Math.max(0, monthlyContribution - savingsAllocation.goal_allocation_total))} available for General Savings this month.`
      : "Create a monthly savings budget to see savings recommendations here.";

  return {
    overview: {
      totalSavings: Number(totalSavings.toFixed(2)),
      goalSavings: Number(goalSavings.toFixed(2)),
      generalSavings: Number(generalSavings.toFixed(2)),
      activeGoals: activeGoals.length,
      completedGoals: completedGoals.length,
      monthlyContribution: Number(monthlyContribution.toFixed(2)),
      savingsRate,
    },
    breakdown: [
      {
        key: "goal_savings",
        label: "Goal Savings",
        amount: Number(goalSavings.toFixed(2)),
        description: "Money currently assigned to savings goals.",
      },
      {
        key: "general_savings",
        label: "General Savings",
        amount: Number(generalSavings.toFixed(2)),
        description: "Savings not assigned to a specific goal.",
      },
    ],
    futureSavingsTypes: ["Emergency Fund", "Cash Reserve", "Investment Pool", "Retirement Savings"],
    allocation: {
      ...savingsAllocation,
      monthly_savings_budget: Number(monthlySavingsBudget.toFixed(2)),
    },
    aiInsight: {
      status: "available",
      message: savingsRate > 0
        ? `You're planning to save ${savingsRate}% of your monthly income. ${aiInsight}`
        : aiInsight,
    },
    goals,
  };
}

export async function getReports(userId: string, options: ReportOptions = {}) {
  const range = getReportRange(options);
  const cacheKey = `${requireUserId(userId)}:${range.period}:${range.start}:${range.end}`;
  const cached = reportCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const [expenses, income, bills, subscriptions, savingsGoals, plan, profile, aiInsights, savingsPreference] = await Promise.all([
    rowsFor("expenses", userId, "date", range.start, range.end),
    rowsFor("income", userId, "date", range.start, range.end),
    rowsFor("bills", userId, "due_date", range.start, range.end),
    client().from("subscriptions").select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null),
    client().from("savings_goals").select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null),
    getBudgetPlan(userId),
    client().from("users").select("currency,income,pay_schedule").eq("id", requireUserId(userId)).maybeSingle(),
    client()
      .from("ai_insights")
      .select("id,type,created_at")
      .eq("user_id", requireUserId(userId))
      .gte("created_at", `${range.start}T00:00:00.000Z`)
      .lte("created_at", `${range.end}T23:59:59.999Z`),
    getSavingsPreference(userId),
  ]);

  const subscriptionsData = "data" in subscriptions ? subscriptions.data ?? [] : [];
  const savingsGoalsData = "data" in savingsGoals ? savingsGoals.data ?? [] : [];
  const aiInsightsData = "data" in aiInsights ? aiInsights.data ?? [] : [];
  const profileData = "data" in profile ? profile.data ?? null : null;
  if ("error" in subscriptions) throwIfError(subscriptions.error);
  if ("error" in savingsGoals) throwIfError(savingsGoals.error);
  if ("error" in aiInsights) throwIfError(aiInsights.error);
  if ("error" in profile) throwIfError(profile.error);

  const paidBills = bills.filter((bill) => bill.status === "paid");
  const outstandingBills = bills.filter((bill) => bill.status !== "paid");
  const subscriptionCharges = subscriptionsData.flatMap((subscription) => getSubscriptionOccurrences(subscription, range));
  const spendingEntries: SpendingEntry[] = [
    ...expenses.map((expense) => ({
      date: String(expense.date),
      amount: asNumber(expense.amount),
      category: String(expense.category || "Uncategorized"),
      source: "expense" as const,
      label: String(expense.merchant || "Expense"),
    })),
    ...paidBills.map((bill) => ({
      date: getDateFromTimestamp(bill.paid_at, String(bill.due_date)),
      amount: asNumber(bill.amount),
      category: String(bill.category || "Bills"),
      source: "bill" as const,
      label: String(bill.title || "Bill"),
      status: String(bill.status || ""),
    })),
    ...subscriptionCharges,
  ];

  const totalIncome = income.reduce((sum, item) => sum + asNumber(item.amount), 0);
  const manualExpenseTotal = expenses.reduce((sum, item) => sum + asNumber(item.amount), 0);
  const paidBillsTotal = paidBills.reduce((sum, item) => sum + asNumber(item.amount), 0);
  const outstandingBillsTotal = outstandingBills.reduce((sum, item) => sum + asNumber(item.amount), 0);
  const subscriptionSpending = subscriptionCharges.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = manualExpenseTotal + paidBillsTotal + subscriptionSpending;
  const netSavings = totalIncome - totalExpenses;
  const categoryTotals = new Map<string, number>();
  const categoryLabels = new Map<string, string>();
  const dailySpending = new Map<string, number>();
  const monthlySpending = new Map<string, number>();
  const monthlyIncome = new Map<string, number>();

  for (const entry of spendingEntries) {
    addCategoryAmount(categoryTotals, entry.category, entry.amount);
    addCategoryLabel(categoryLabels, entry.category);
    addAmountByDate(dailySpending, entry.date, entry.amount);
    addAmountByMonth(monthlySpending, entry.date, entry.amount);
  }

  for (const item of income) {
    addAmountByMonth(monthlyIncome, String(item.date), asNumber(item.amount));
  }

  const categories = Array.from(categoryTotals.entries())
    .map(([key, amount]) => ({
      name: categoryLabels.get(key) ?? key,
      amount: Number(amount.toFixed(2)),
      percent: totalExpenses ? Number(((amount / totalExpenses) * 100).toFixed(1)) : 0,
    }))
    .sort((left, right) => right.amount - left.amount);
  const nonZeroCategories = categories.filter((category) => category.amount > 0);
  const highestSpendingCategory = nonZeroCategories[0] ?? null;
  const lowestSpendingCategory = nonZeroCategories.length ? nonZeroCategories[nonZeroCategories.length - 1] : null;
  const budgetCategories = normalizeBudgetCategories(plan?.categories);
  const plannedBudget = budgetCategories.reduce((sum, category) => sum + category.budget, 0) * range.budgetMonths;
  const monthlySavingsBudget = budgetCategories.find(isSavingsCategory)?.budget ?? 0;
  const savingsAllocation = buildSavingsAllocationSummary(
    monthlySavingsBudget,
    Boolean(budgetCategories.find(isSavingsCategory)?.auto_distribute),
    savingsGoalsData,
    savingsPreference.remaining_savings_behavior,
  );
  const plannedSavingsAllocation = monthlySavingsBudget * range.budgetMonths;
  const plannedGoalAllocation = savingsAllocation.goal_allocation_total * range.budgetMonths;
  const plannedGeneralSavings = savingsAllocation.general_savings * range.budgetMonths;
  const plannedUnallocatedSavings = savingsAllocation.unallocated_savings * range.budgetMonths;
  const budgetRows = budgetCategories.map((category, index) => {
    const isGoal = isSavingsCategory(category);
    const budget = category.budget * range.budgetMonths;
    const spent = isGoal ? 0 : categoryTotals.get(normalizeCategoryKey(category.name)) ?? 0;

    return {
      id: category.id,
      name: category.name,
      budget: Number(budget.toFixed(2)),
      spent: Number(spent.toFixed(2)),
      remaining: Number((budget - spent).toFixed(2)),
      percent: budget ? Math.round((spent / budget) * 100) : spent > 0 ? 100 : 0,
      color: budgetColors[index % budgetColors.length],
      goal: isGoal,
    };
  });
  const plannedKeys = new Set(budgetCategories.map((category) => normalizeCategoryKey(category.name)).filter(Boolean));

  for (const [key, spent] of categoryTotals.entries()) {
    if (plannedKeys.has(key) || key === "savings") {
      continue;
    }

    budgetRows.push({
      id: `unplanned-${key}`,
      name: categoryLabels.get(key) ?? key,
      budget: 0,
      spent: Number(spent.toFixed(2)),
      remaining: Number((-spent).toFixed(2)),
      percent: spent > 0 ? 100 : 0,
      color: budgetColors[budgetRows.length % budgetColors.length],
      goal: false,
    });
  }

  const totalSaved = savingsGoalsData.reduce((sum, goal) => sum + asNumber(goal.current_amount), 0);
  const savingsTarget = savingsGoalsData.reduce((sum, goal) => sum + asNumber(goal.target_amount), 0);
  const activeGoals = savingsGoalsData.filter((goal) => !goal.completed_at && asNumber(goal.current_amount) < asNumber(goal.target_amount));
  const completedGoals = savingsGoalsData.filter((goal) => goal.completed_at || asNumber(goal.current_amount) >= asNumber(goal.target_amount));
  const monthlyContributions = savingsGoalsData.reduce((sum, goal) => sum + asNumber(goal.monthly_target), 0);
  const monthKeys = monthKeysBetween(range.start, range.end);
  const result = {
    range,
    profile: {
      currency: profileData?.currency ?? "PHP",
      configured_income: asNumber(profileData?.income),
      pay_schedule: profileData?.pay_schedule ?? "monthly",
    },
    total_income: Number(totalIncome.toFixed(2)),
    total_expenses: Number(totalExpenses.toFixed(2)),
    net_savings: Number(netSavings.toFixed(2)),
    savings_rate: totalIncome ? Number(((netSavings / totalIncome) * 100).toFixed(1)) : 0,
    budget_utilization: plannedBudget ? Math.round((totalExpenses / plannedBudget) * 100) : 0,
    remaining_budget: Number((plannedBudget - totalExpenses).toFixed(2)),
    total_bills_paid: Number(paidBillsTotal.toFixed(2)),
    outstanding_bills: Number(outstandingBillsTotal.toFixed(2)),
    subscription_spending: Number(subscriptionSpending.toFixed(2)),
    savings_contributions: Number(totalSaved.toFixed(2)),
    average_daily_spending: Number((totalExpenses / range.days).toFixed(2)),
    average_weekly_spending: Number((totalExpenses / Math.max(1, range.days / 7)).toFixed(2)),
    average_monthly_spending: Number((totalExpenses / Math.max(1, range.budgetMonths)).toFixed(2)),
    highest_spending_category: highestSpendingCategory,
    lowest_spending_category: lowestSpendingCategory,
    monthly_trend: monthKeys.map((month) => ({
      month,
      income: Number((monthlyIncome.get(month) ?? 0).toFixed(2)),
      expenses: Number((monthlySpending.get(month) ?? 0).toFixed(2)),
      net: Number(((monthlyIncome.get(month) ?? 0) - (monthlySpending.get(month) ?? 0)).toFixed(2)),
    })),
    categories,
    budget: {
      total_budget: Number(plannedBudget.toFixed(2)),
      spent: Number(totalExpenses.toFixed(2)),
      remaining: Number((plannedBudget - totalExpenses).toFixed(2)),
      utilization_percent: plannedBudget ? Math.round((totalExpenses / plannedBudget) * 100) : 0,
      monthly_savings_budget: Number(plannedSavingsAllocation.toFixed(2)),
      goal_allocation_total: Number(plannedGoalAllocation.toFixed(2)),
      general_savings: Number(plannedGeneralSavings.toFixed(2)),
      unallocated_savings: Number(plannedUnallocatedSavings.toFixed(2)),
      goal_allocations: savingsAllocation.goal_allocations.map((allocation) => ({
        ...allocation,
        amount: Number((allocation.amount * range.budgetMonths).toFixed(2)),
      })),
      remaining_savings_behavior: savingsAllocation.remaining_savings_behavior,
      remaining_savings_label: savingsAllocation.remaining_savings_label,
      monthly_savings_allocation: Number(plannedSavingsAllocation.toFixed(2)),
      savings_allocation_usage: plannedSavingsAllocation ? Math.round((plannedGoalAllocation / plannedSavingsAllocation) * 100) : 0,
      over_budget_categories: budgetRows.filter((category) => !category.goal && category.spent > category.budget),
      under_budget_categories: budgetRows.filter((category) => !category.goal && category.budget > 0 && category.spent <= category.budget),
      categories: budgetRows,
    },
    savings: {
      total_saved: Number(totalSaved.toFixed(2)),
      total_goal_savings: Number(totalSaved.toFixed(2)),
      general_savings: Number(plannedGeneralSavings.toFixed(2)),
      monthly_savings_budget: Number(plannedSavingsAllocation.toFixed(2)),
      active_goals: activeGoals.length,
      completed_goals: completedGoals.length,
      goal_progress: savingsTarget ? Math.round((totalSaved / savingsTarget) * 100) : 0,
      monthly_contributions: Number(monthlyContributions.toFixed(2)),
      contribution_history: [] as Array<{ date: string; amount: number; goal: string }>,
      savings_allocation_history: [] as Array<{ month: string; goal_allocation: number; general_savings: number; unallocated_savings: number }>,
      goal_contribution_history: [] as Array<{ date: string; amount: number; goal: string }>,
      projected_completion: activeGoals.map((goal) => ({
        id: String(goal.id),
        title: String(goal.title),
        projected_date: String(goal.deadline),
        progress_percent: asNumber(goal.target_amount) ? Math.round((asNumber(goal.current_amount) / asNumber(goal.target_amount)) * 100) : 0,
      })),
      distribution: savingsGoalsData.map((goal) => ({
        name: String(goal.title),
        amount: Number(asNumber(goal.current_amount).toFixed(2)),
        target: Number(asNumber(goal.target_amount).toFixed(2)),
      })),
    },
    charts: {
      daily_spending: sortedSeries(dailySpending),
      monthly_spending: monthKeys.map((month) => ({ month, amount: Number((monthlySpending.get(month) ?? 0).toFixed(2)) })),
      income_vs_expense: monthKeys.map((month) => ({
        month,
        income: Number((monthlyIncome.get(month) ?? 0).toFixed(2)),
        expenses: Number((monthlySpending.get(month) ?? 0).toFixed(2)),
      })),
      budget_vs_actual: budgetRows.map((category) => ({ name: category.name, budget: category.budget, actual: category.spent })),
      savings_growth: savingsGoalsData.map((goal) => ({
        name: String(goal.title),
        current: Number(asNumber(goal.current_amount).toFixed(2)),
        target: Number(asNumber(goal.target_amount).toFixed(2)),
      })),
      category_distribution: categories,
      bills_timeline: bills.map((bill) => ({
        date: String(bill.due_date),
        amount: asNumber(bill.amount),
        label: String(bill.title || "Bill"),
        status: String(bill.status || "unpaid"),
      })).sort((left, right) => left.date.localeCompare(right.date)),
      subscriptions_timeline: subscriptionCharges.map((charge) => ({
        date: charge.date,
        amount: charge.amount,
        label: charge.label,
      })).sort((left, right) => left.date.localeCompare(right.date)),
    },
    data_sources: {
      income: income.length,
      expenses: expenses.length,
      bills: bills.length,
      subscriptions: subscriptionsData.length,
      savings_goals: savingsGoalsData.length,
      budget_categories: budgetCategories.length,
      ocr_expenses: expenses.filter((expense) => expense.ocr_raw).length,
      ai_insights: aiInsightsData.length,
    },
    daily_spending: sortedSeries(dailySpending),
  };

  reportCache.set(cacheKey, { expiresAt: Date.now() + reportCacheTtlMs, data: result });

  return result;
}

export async function getDashboardSummary(userId: string) {
  const current = monthRange();
  const previous = previousMonthRange();
  const chartStartDate = new Date(`${current.start}T12:00:00Z`);
  chartStartDate.setUTCMonth(chartStartDate.getUTCMonth() - 7, 1);
  const chartStart = monthRange(chartStartDate).start;
  const dueWeekEnd = addDaysIso(7);
  const [bills, expenses, previousExpenses, previousBills, chartExpenses, dueWeekBills, goals, subscriptions] = await Promise.all([
    rowsFor("bills", userId, "due_date", current.start, current.end),
    rowsFor("expenses", userId, "date", current.start, current.end),
    rowsFor("expenses", userId, "date", previous.start, previous.end),
    rowsFor("bills", userId, "due_date", previous.start, previous.end),
    rowsFor("expenses", userId, "date", chartStart, current.end),
    rowsFor("bills", userId, "due_date", current.start, dueWeekEnd),
    client().from("savings_goals").select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null),
    client().from("subscriptions").select("*").eq("user_id", requireUserId(userId)).is("deleted_at", null),
  ]);

  const goalsData = "data" in goals ? goals.data ?? [] : [];
  const subscriptionsData = "data" in subscriptions ? subscriptions.data ?? [] : [];
  if ("error" in goals) throwIfError(goals.error);
  if ("error" in subscriptions) throwIfError(subscriptions.error);

  const paidBills = bills.filter((bill) => bill.status === "paid");
  const previousPaidBills = previousBills.filter((bill) => bill.status === "paid");
  const monthlyExpenses = expenses.reduce((sum, item) => sum + asNumber(item.amount), 0)
    + paidBills.reduce((sum, item) => sum + asNumber(item.amount), 0);
  const previousTotal = previousExpenses.reduce((sum, item) => sum + asNumber(item.amount), 0)
    + previousPaidBills.reduce((sum, item) => sum + asNumber(item.amount), 0);
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
  const aiInsight = await generateDashboardInsight({
    month: current.start.slice(0, 7),
    expenses,
    bills,
    subscriptions: subscriptionsData,
    savingsGoals: goalsData,
    budget,
  });

  return {
    total_bills_this_month: bills.reduce((sum, item) => sum + asNumber(item.amount), 0),
    bills_due_this_week: dueWeekBills.filter((bill) => bill.due_date >= todayIso() && bill.due_date <= dueWeekEnd).reduce((sum, item) => sum + asNumber(item.amount), 0),
    monthly_expenses: monthlyExpenses,
    monthly_expenses_delta_percent: previousTotal ? Math.round(((monthlyExpenses - previousTotal) / previousTotal) * 100) : 0,
    savings_progress_percent: savingsTarget ? Math.round((savingsCurrent / savingsTarget) * 100) : 0,
    savings_current: savingsCurrent,
    savings_target: savingsTarget,
    health_score: Math.round(billScore + savingsRateScore + subscriptionScore + budgetScore),
    weekly_bills: dueWeekBills.filter((bill) => bill.due_date >= todayIso() && bill.due_date <= dueWeekEnd),
    recent_activity: [...chartExpenses].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 5),
    monthly_spending: buildMonthlySpending(chartExpenses, new Date()),
    ai_insight: aiInsight,
  };
}
