import { asNumber } from "./db.js";
import { createGeminiProvider } from "./ai.providers.js";

type DashboardInsightInput = {
  month: string;
  expenses: Array<Record<string, unknown>>;
  bills: Array<Record<string, unknown>>;
  subscriptions: Array<Record<string, unknown>>;
  savingsGoals: Array<Record<string, unknown>>;
  budget: Awaited<ReturnType<() => Promise<unknown>>> | null;
};

export type DashboardInsight = {
  status: "configured" | "not_configured" | "error";
  message: string;
};

function compactContext(input: DashboardInsightInput) {
  const budget = input.budget && typeof input.budget === "object"
    ? input.budget as Record<string, unknown>
    : null;

  return {
    month: input.month,
    expenses: {
      total: Number(input.expenses.reduce((sum, row) => sum + asNumber(row.amount), 0).toFixed(2)),
      transactions: input.expenses.slice(0, 12).map((row) => ({
        merchant: row.merchant ?? row.description ?? "Expense",
        amount: asNumber(row.amount),
        category: row.category ?? "Uncategorized",
        date: row.date,
      })),
    },
    bills: input.bills.slice(0, 10).map((row) => ({
      title: row.title,
      amount: asNumber(row.amount),
      due_date: row.due_date,
      status: row.status,
    })),
    subscriptions: input.subscriptions.slice(0, 10).map((row) => ({
      name: row.name,
      amount: asNumber(row.amount),
      billing_cycle: row.billing_cycle,
      renewal_date: row.renewal_date,
    })),
    savings_goals: input.savingsGoals.slice(0, 10).map((row) => ({
      title: row.title,
      current_amount: asNumber(row.current_amount),
      target_amount: asNumber(row.target_amount),
      deadline: row.deadline,
    })),
    budget: budget
      ? {
          budget_amount: asNumber(budget.budget_amount),
          spent_amount: asNumber(budget.spent_amount),
          remaining_budget: asNumber(budget.remaining_budget),
          used_percent: asNumber(budget.used_percent),
        }
      : null,
  };
}

export async function generateDashboardInsight(input: DashboardInsightInput): Promise<DashboardInsight> {
  const provider = createGeminiProvider();

  if (!provider.isConfigured()) {
    return {
      status: "not_configured",
      message: "AI insights are temporarily unavailable because the AI provider is not configured.",
    };
  }

  try {
    const message = await provider.generate({
      language: "en",
      history: [],
      financialContext: compactContext(input),
      message: [
        "Create one personalized dashboard insight for this user.",
        "Use only the supplied financial context.",
        "Return 1-2 concise sentences, with one concrete action when the data supports it.",
        "Do not use headings, markdown, greetings, or claims about data that is not present.",
      ].join(" "),
    });

    return { status: "configured", message };
  } catch {
    return {
      status: "error",
      message: "AI insights are temporarily unavailable. Open Alalay AI to try again.",
    };
  }
}
