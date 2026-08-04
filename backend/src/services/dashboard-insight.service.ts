import { asNumber, client, requireUserId } from "./db.js";
import { createGeminiProvider } from "./ai.providers.js";

const dashboardInsightCacheTtlMs = 24 * 60 * 60 * 1000;
const dashboardInsightInFlight = new Map<string, Promise<DashboardInsight>>();

type DashboardInsightInput = {
  month: string;
  monthlyIncome: number;
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
    monthly_income: input.monthlyIncome,
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

async function generateDashboardInsightUncached(userId: string, input: DashboardInsightInput): Promise<DashboardInsight> {
  const profileId = requireUserId(userId);
  const { data: cached, error: cacheReadError } = await client()
    .from("dashboard_insights")
    .select("message, generated_at")
    .eq("user_id", profileId)
    .maybeSingle();

  // A missing cache table should not take down the Dashboard; the migration
  // creates it in normal deployments, while this fallback preserves AI output
  // during rolling deployments.
  if (!cacheReadError && cached && Date.now() - new Date(cached.generated_at).getTime() < dashboardInsightCacheTtlMs) {
    return { status: "configured", message: cached.message };
  }

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

    const { error: cacheWriteError } = await client()
      .from("dashboard_insights")
      .upsert({ user_id: profileId, message, generated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (cacheWriteError) {
      // Do not hide a successful Gemini response if persistence is temporarily unavailable.
      console.warn("Unable to persist dashboard AI insight cache:", cacheWriteError.message);
    }

    return { status: "configured", message };
  } catch {
    return {
      status: "error",
      message: "AI insights are temporarily unavailable. Open Alalay AI to try again.",
    };
  }
}

export async function generateDashboardInsight(userId: string, input: DashboardInsightInput): Promise<DashboardInsight> {
  const profileId = requireUserId(userId);
  const existing = dashboardInsightInFlight.get(profileId);
  if (existing) return existing;

  const request = generateDashboardInsightUncached(profileId, input);
  dashboardInsightInFlight.set(profileId, request);
  try {
    return await request;
  } finally {
    if (dashboardInsightInFlight.get(profileId) === request) {
      dashboardInsightInFlight.delete(profileId);
    }
  }
}
