import { getBudgetSummary, getDashboardSummary, getReports } from "./analytics.service.js";
import { asNumber, client, monthRange, requireUserId, todayIso, throwIfError } from "./db.js";
import { getProfile } from "./settings.service.js";

type ContextTopic = "overview" | "spending" | "bills" | "subscriptions" | "budget" | "savings" | "reports";

function normalizeCategoryKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function detectTopics(message: string): ContextTopic[] {
  const text = message.toLowerCase();
  const topics = new Set<ContextTopic>(["overview"]);

  if (/spend|spent|expense|transaction|purchase|category|gastos|gumastos/i.test(text)) topics.add("spending");
  if (/bill|due|overdue|bayarin|deadline/i.test(text)) topics.add("bills");
  if (/subscription|renew|cancel|recurring|netflix|spotify|membership/i.test(text)) topics.add("subscriptions");
  if (/budget|overspend|over budget|remaining|afford|kaya|kasya/i.test(text)) topics.add("budget");
  if (/save|savings|goal|emergency|ipon|mag-ipon/i.test(text)) topics.add("savings");
  if (/compare|trend|last month|report|habit|why|bakit/i.test(text)) topics.add("reports");

  return Array.from(topics);
}

async function rowsFor(table: string, userId: string, dateColumn: string, from: string, to: string) {
  const { data, error } = await client()
    .from(table)
    .select("*")
    .eq("user_id", requireUserId(userId))
    .is("deleted_at", null)
    .gte(dateColumn, from)
    .lte(dateColumn, to)
    .order(dateColumn, { ascending: false });

  throwIfError(error);
  return data ?? [];
}

async function recentRows(table: string, userId: string, limit = 8) {
  const { data, error } = await client()
    .from(table)
    .select("*")
    .eq("user_id", requireUserId(userId))
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  throwIfError(error);
  return data ?? [];
}

function sumRows(rows: Array<Record<string, unknown>>, field = "amount") {
  return Number(rows.reduce((sum, row) => sum + asNumber(row[field]), 0).toFixed(2));
}

function categoryTotals(expenses: Array<Record<string, unknown>>) {
  const totals = new Map<string, { name: string; amount: number }>();

  for (const expense of expenses) {
    const category = String(expense.category || "Uncategorized");
    const key = normalizeCategoryKey(category) || "uncategorized";
    const current = totals.get(key) ?? { name: category, amount: 0 };
    current.amount += asNumber(expense.amount);
    totals.set(key, current);
  }

  return Array.from(totals.values())
    .map((item) => ({ ...item, amount: Number(item.amount.toFixed(2)) }))
    .sort((left, right) => right.amount - left.amount);
}

function subscriptionMonthlyAmount(subscription: Record<string, unknown>) {
  const amount = asNumber(subscription.amount);
  return subscription.billing_cycle === "yearly" ? amount / 12 : amount;
}

function buildRiskAlerts(input: {
  budget: Awaited<ReturnType<typeof getBudgetSummary>> | null;
  bills: Array<Record<string, unknown>>;
  subscriptions: Array<Record<string, unknown>>;
  currentExpenses: Array<Record<string, unknown>>;
  report: Awaited<ReturnType<typeof getReports>>;
}) {
  const alerts: string[] = [];
  const today = todayIso();
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const dueBills = input.bills.filter((bill) => String(bill.due_date) >= today && String(bill.due_date) <= nextWeek && bill.status !== "paid");
  const overdueBills = input.bills.filter((bill) => String(bill.due_date) < today && bill.status !== "paid");
  const duplicateSubscriptions = new Set<string>();
  const seenSubscriptions = new Set<string>();

  for (const subscription of input.subscriptions) {
    const key = String(subscription.name || "").trim().toLowerCase();
    if (!key) continue;
    if (seenSubscriptions.has(key)) duplicateSubscriptions.add(String(subscription.name));
    seenSubscriptions.add(key);
  }

  if (dueBills.length) alerts.push(`${dueBills.length} bill(s) due within 7 days.`);
  if (overdueBills.length) alerts.push(`${overdueBills.length} overdue bill(s).`);
  if (duplicateSubscriptions.size) alerts.push(`Possible duplicate subscriptions: ${Array.from(duplicateSubscriptions).join(", ")}.`);
  if (input.budget?.remaining_budget !== undefined && Number(input.budget.remaining_budget) < 0) alerts.push("Current budget is over the planned amount.");
  if (input.report.net_savings < 0) alerts.push("Expenses are higher than income for the selected period.");

  const largeExpense = input.currentExpenses.find((expense) => asNumber(expense.amount) >= Math.max(1000, input.report.average_daily_spending * 3));
  if (largeExpense) alerts.push(`Large transaction detected: ${largeExpense.merchant ?? "Expense"} at ${asNumber(largeExpense.amount)}.`);

  return alerts;
}

export async function buildFinancialContext(userId: string, message: string) {
  const topics = detectTopics(message);
  const current = monthRange();
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const previous = monthRange(lastMonthDate);

  const [
    profile,
    dashboard,
    budget,
    report,
    previousReport,
    currentIncome,
    currentExpenses,
    currentBills,
    recentExpenses,
    subscriptions,
    savingsGoals,
  ] = await Promise.all([
    getProfile(userId),
    getDashboardSummary(userId),
    getBudgetSummary(userId),
    getReports(userId, { period: "this_month" }),
    getReports(userId, { period: "last_month" }),
    rowsFor("income", userId, "date", current.start, current.end),
    rowsFor("expenses", userId, "date", current.start, current.end),
    rowsFor("bills", userId, "due_date", current.start, current.end),
    recentRows("expenses", userId, 8),
    recentRows("subscriptions", userId, 12),
    recentRows("savings_goals", userId, 12),
  ]);

  const categories = categoryTotals(currentExpenses);
  const subscriptionMonthlyTotal = Number(subscriptions.reduce((sum, item) => sum + subscriptionMonthlyAmount(item), 0).toFixed(2));
  const savingsTarget = savingsGoals.reduce((sum, goal) => sum + asNumber(goal.target_amount), 0);
  const savingsCurrent = savingsGoals.reduce((sum, goal) => sum + asNumber(goal.current_amount), 0);
  const riskAlerts = buildRiskAlerts({ budget, bills: currentBills, subscriptions, currentExpenses, report });

  const context: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    user: {
      currency: profile.currency ?? "PHP",
      preferred_language: profile.language ?? "en",
      pay_schedule: profile.pay_schedule ?? "monthly",
      configured_monthly_income: asNumber(profile.income),
    },
    range: current,
    financial_score: dashboard.health_score,
    monthly_summary: {
      income: sumRows(currentIncome),
      expenses: sumRows(currentExpenses),
      cash_flow: Number((sumRows(currentIncome) - sumRows(currentExpenses)).toFixed(2)),
      dashboard_monthly_expenses: dashboard.monthly_expenses,
      month_vs_last_month_expense_delta_percent: dashboard.monthly_expenses_delta_percent,
      savings_rate: report.savings_rate,
      budget_utilization: report.budget_utilization,
      remaining_budget: budget?.remaining_budget ?? report.remaining_budget,
    },
    risk_alerts: riskAlerts,
  };

  if (topics.includes("spending") || topics.includes("overview")) {
    context.spending = {
      highest_category: categories[0] ?? null,
      categories: categories.slice(0, 8),
      recent_transactions: recentExpenses.map((expense) => ({
        merchant: expense.merchant,
        amount: asNumber(expense.amount),
        category: expense.category,
        date: expense.date,
        payment_method: expense.payment_method,
        from_ocr: Boolean(expense.ocr_raw),
      })),
    };
  }

  if (topics.includes("bills") || topics.includes("overview")) {
    context.bills = {
      total_this_month: dashboard.total_bills_this_month,
      due_this_week: dashboard.bills_due_this_week,
      rows: currentBills.slice(0, 10).map((bill) => ({
        title: bill.title,
        amount: asNumber(bill.amount),
        category: bill.category,
        due_date: bill.due_date,
        status: bill.status,
        recurring: bill.recurring,
      })),
    };
  }

  if (topics.includes("subscriptions")) {
    context.subscriptions = {
      monthly_estimate: subscriptionMonthlyTotal,
      rows: subscriptions.map((subscription) => ({
        name: subscription.name,
        amount: asNumber(subscription.amount),
        billing_cycle: subscription.billing_cycle,
        renewal_date: subscription.renewal_date,
        auto_renew: subscription.auto_renew,
        last_used_at: subscription.last_used_at,
      })),
    };
  }

  if (topics.includes("budget") || topics.includes("overview")) {
    context.budget = budget
      ? {
          month: budget.month,
          monthly_income: budget.monthly_income,
          budget_amount: budget.budget_amount,
          spent_amount: budget.spent_amount,
          saved_amount: budget.saved_amount,
          remaining_budget: budget.remaining_budget,
          unallocated_income: budget.unallocated_income,
          categories: budget.categories.map((category) => ({
            name: category.name,
            budget: category.budget,
            spent: category.spent,
            percent: category.percent,
            goal: category.goal,
          })),
        }
      : null;
  }

  if (topics.includes("savings") || topics.includes("overview")) {
    context.savings = {
      current: Number(savingsCurrent.toFixed(2)),
      target: Number(savingsTarget.toFixed(2)),
      progress_percent: savingsTarget ? Math.round((savingsCurrent / savingsTarget) * 100) : 0,
      monthly_savings_budget: budget?.monthly_savings_budget ?? report.savings.monthly_savings_budget,
      goals: savingsGoals.map((goal) => ({
        title: goal.title,
        current_amount: asNumber(goal.current_amount),
        target_amount: asNumber(goal.target_amount),
        monthly_target: asNumber(goal.monthly_target),
        deadline: goal.deadline,
        completed: Boolean(goal.completed_at),
      })),
    };
  }

  if (topics.includes("reports")) {
    context.trends = {
      this_month: {
        income: report.total_income,
        expenses: report.total_expenses,
        net_savings: report.net_savings,
        average_daily_spending: report.average_daily_spending,
        categories: report.categories.slice(0, 8),
      },
      last_month: {
        income: previousReport.total_income,
        expenses: previousReport.total_expenses,
        net_savings: previousReport.net_savings,
        average_daily_spending: previousReport.average_daily_spending,
        categories: previousReport.categories.slice(0, 8),
      },
      previous_range: previous,
    };
  }

  return context;
}
