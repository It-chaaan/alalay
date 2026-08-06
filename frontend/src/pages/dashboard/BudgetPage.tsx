import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { BudgetFormPanel } from "../../components/forms/FinancialActionPanels";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useActionDialog } from "../../hooks/useActionDialog";
import { useBudget } from "../../hooks/useBudget";
import { useIncomeSummary } from "../../hooks/useIncomeSummary";
import { useSavingsGoals } from "../../hooks/useSavingsGoals";
import type { BudgetSummary, SavingsGoal } from "../../hooks/types";
import { formatCurrency, formatSignedCurrency } from "../../utils/formatters";
import { CategoryBadge } from "../../components/ui/CategoryBadge";
import { PageSkeleton, SlowLoadNotice } from "../../components/ui/Skeleton";

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

function getMonthLabel(month?: string) {
  if (!month) {
    return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date());
  }

  const [year, monthIndex] = month.split("-");
  const parsedYear = Number(year);
  const parsedMonth = Number(monthIndex);

  if (!parsedYear || !parsedMonth) {
    return month;
  }

  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(parsedYear, parsedMonth - 1, 1));
}

function getCurrentMonthKey() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");

  return `${today.getFullYear()}-${month}`;
}

function addMonthsToMonthKey(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");

  return `${date.getFullYear()}-${nextMonth}`;
}

function getFallbackGoalAllocations(
  savingsBudget: number,
  autoDistribute: boolean,
  goals: SavingsGoal[],
) {
  if (!autoDistribute || savingsBudget <= 0) {
    return [];
  }

  let remainingBudget = savingsBudget;
  const allocations = [];
  const activeGoals = goals
    .map((goal) => {
      const currentAmount = Number(goal.current_amount);
      const targetAmount = Number(goal.target_amount);
      const remaining = Math.max(0, targetAmount - currentAmount);
      const monthlyTarget = Number(goal.monthly_target);

      return {
        goal,
        currentAmount,
        targetAmount,
        remaining,
        plannedAmount: Math.max(0, monthlyTarget),
      };
    })
    .filter((item) => !item.goal.completed_at && item.remaining > 0 && item.plannedAmount > 0)
    .sort((left, right) => left.goal.deadline.localeCompare(right.goal.deadline));

  for (const item of activeGoals) {
    if (remainingBudget <= 0) {
      break;
    }

    const amount = Math.min(remainingBudget, item.remaining, item.plannedAmount);

    if (amount > 0) {
      allocations.push({
        goal_id: item.goal.id,
        title: item.goal.title,
        amount,
        progress_percent: item.targetAmount ? Math.round((item.currentAmount / item.targetAmount) * 100) : 0,
      });
      remainingBudget -= amount;
    }
  }

  return allocations;
}

function MonthPicker({ label, onPrevious, onNext }: { label: string; onPrevious: () => void; onNext: () => void }) {
  return (
    <div className="inline-flex h-9 items-center gap-4 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-950 shadow-sm">
      <button type="button" onClick={onPrevious} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-50" aria-label="Previous month">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <span>{label}</span>
      <button type="button" onClick={onNext} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-50" aria-label="Next month">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  );
}

function FlowCard({ label, value, note, detail, tone = "default" }: { label: string; value: string; note?: string; detail?: string; tone?: "default" | "income" | "savings" | "warning" }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <article className="h-full rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5">
        <p className="text-xs text-slate-500">{label}</p>
        {detail ? (
          <span className="group relative inline-flex">
            <button
              type="button"
              onClick={() => setShowDetails((visible) => !visible)}
              aria-label={`More information about ${label}`}
              aria-expanded={showDetails}
              className="rounded-full text-slate-400 transition hover:text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-muted"
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span
              role="tooltip"
              className={`${showDetails ? "block" : "hidden group-hover:block"} absolute left-0 top-6 z-10 w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700 shadow-lg`}
            >
              {detail}
            </span>
          </span>
        ) : null}
      </div>
      <p className={`mt-3 font-mono text-xl font-bold ${tone === "income" ? "text-[#3f7d16]" : tone === "savings" ? "text-brand-primary" : tone === "warning" ? "text-[#c57a12]" : "text-slate-950"}`}>{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </article>
  );
}

function HealthRow({ label, amount, percent, color }: { label: string; amount: number; percent: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-xs">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-mono text-slate-500">{formatCurrency(amount)} · {percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100">
        <div className="h-1.5 rounded-full" style={{ width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function BudgetPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = getDisplayName(session);
  const budgetDialog = useActionDialog("budget");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const { data: fetchedBudgetSummary, isLoading, isSlowLoading, error, refetch } = useBudget(selectedMonth);
  const { data: incomeSummary } = useIncomeSummary(selectedMonth);
  const { data: savingsGoals, refetch: refetchSavingsGoals } = useSavingsGoals();
  const [optimisticBudgetSummary, setOptimisticBudgetSummary] = useState<BudgetSummary | null>(null);
  const budgetSummary = optimisticBudgetSummary ?? fetchedBudgetSummary;
  const hasBudget = Boolean(budgetSummary);
  const monthLabel = getMonthLabel(selectedMonth);
  const goals = savingsGoals ?? [];
  const activeGoals = goals.filter((goal) => !goal.completed_at && Number(goal.current_amount) < Number(goal.target_amount));
  const savingsBudget = Number(budgetSummary?.monthly_savings_budget ?? budgetSummary?.savings_allocation ?? 0);
  const savingsAutoDistribute = Boolean(budgetSummary?.savings_auto_distribute);
  const backendGoalAllocations = budgetSummary?.goal_allocations ?? [];
  const goalAllocations = backendGoalAllocations.length > 0
    ? backendGoalAllocations
    : getFallbackGoalAllocations(savingsBudget, savingsAutoDistribute, goals);
  const goalAllocationTotal = goalAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
  const remainingSavingsBehavior = budgetSummary?.remaining_savings_behavior ?? "auto_general";
  const generalSavings = budgetSummary?.general_savings !== undefined
    ? Number(budgetSummary.general_savings)
    : remainingSavingsBehavior === "auto_general"
      ? Math.max(0, savingsBudget - goalAllocationTotal)
      : 0;
  const unallocatedSavings = budgetSummary?.unallocated_savings !== undefined
    ? Number(budgetSummary.unallocated_savings)
    : remainingSavingsBehavior === "auto_general"
      ? 0
      : Math.max(0, savingsBudget - goalAllocationTotal);
  const remainingSavingsLabel = budgetSummary?.remaining_savings_label ?? "Automatically move remaining savings into General Savings";
  const spendingCategories = budgetSummary?.categories.filter((category) => !category.goal) ?? [];
  const categoryBudget = spendingCategories.reduce((sum, category) => sum + Number(category.budget), 0);
  const monthlyIncome = Number(incomeSummary?.this_month ?? budgetSummary?.monthly_income ?? 0);
  const budgetAmount = Number(budgetSummary?.budget_amount ?? budgetSummary?.total_budget ?? 0);
  const spentAmount = Number(budgetSummary?.spent_amount ?? budgetSummary?.total_spent ?? 0);
  const savedAmount = Number(budgetSummary?.saved_amount ?? savingsBudget);
  const remainingBudget = Number(budgetSummary?.remaining_budget ?? budgetSummary?.remaining ?? 0);
  const unallocatedIncome = monthlyIncome - budgetAmount;
  const budgetHealth = {
    income: monthlyIncome,
    budgeted_percent: monthlyIncome ? Math.round((budgetAmount / monthlyIncome) * 100) : 0,
    spent_percent: monthlyIncome ? Math.round((spentAmount / monthlyIncome) * 100) : budgetAmount ? Math.round((spentAmount / budgetAmount) * 100) : 0,
    saved_percent: monthlyIncome ? Math.round((savedAmount / monthlyIncome) * 100) : 0,
    remaining_percent: budgetAmount ? Math.round((Math.max(0, remainingBudget) / budgetAmount) * 100) : 0,
    unallocated_percent: monthlyIncome ? Math.round((unallocatedIncome / monthlyIncome) * 100) : 0,
  };

  useEffect(() => {
    if (fetchedBudgetSummary && fetchedBudgetSummary.month === selectedMonth) {
      setOptimisticBudgetSummary(null);
    }
  }, [selectedMonth, fetchedBudgetSummary]);

  function refetchBudgetAndGoals(result?: unknown) {
    if (result && typeof result === "object" && "month" in result && (result as BudgetSummary).month === selectedMonth) {
      setOptimisticBudgetSummary(result as BudgetSummary);
    }

    refetch();
    refetchSavingsGoals();
  }

  return (
    <DashboardShell
      activeLabel="Budget"
      title="Budget"
      subtitle={`Monthly plan - ${monthLabel}`}
      name={name}
      onSignOut={onSignOut}
      secondaryAction={<MonthPicker label={monthLabel} onPrevious={() => setSelectedMonth((month) => addMonthsToMonthKey(month, -1))} onNext={() => setSelectedMonth((month) => addMonthsToMonthKey(month, 1))} />}
      action={
        <button
          type="button"
          onClick={budgetDialog.open}
          disabled={isLoading}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 3 5 5L8 21H3v-5L16 3Z" /></svg>{hasBudget ? "Edit Budget" : "Create Budget"}
        </button>
      }
    >
{isLoading ? <><PageSkeleton kind="budget" /><SlowLoadNotice show={isSlowLoading} /></> : null}
      {error ? <div className="rounded-[14px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
      {!isLoading && !error && !budgetSummary ? <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">No budget has been created yet. Start by setting your category allocations.</div> : null}
      {budgetSummary ? (
        <>
      <section className="rounded-[14px] border border-emerald-200 bg-[#dff4ed] p-4 text-sm text-brand-dark dark:border-emerald-700 dark:bg-[#1d3a30] dark:text-brand-muted">
        <div className="flex gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-primary text-white">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" /></svg>
          </span>
          <div>
            <h2 className="font-semibold">Alalay budget tip</h2>
            <p className="mt-1 text-xs leading-5 text-slate-700 dark:text-slate-200">
              {unallocatedIncome >= 0
                ? `${formatCurrency(unallocatedIncome)} of this month's income has not been assigned to the budget yet.`
                : `Your budget is ${formatCurrency(Math.abs(unallocatedIncome))} above recorded income for this month.`}
            {" "}Bills and subscriptions due this month are counted in category spending.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <FlowCard label="Monthly Income" value={formatCurrency(monthlyIncome)} note="Income received this month" tone="income" />
        <FlowCard
          label="Budgeted Amount"
          value={formatCurrency(budgetAmount)}
          note="Includes category budgets + savings budget"
          detail={`${budgetHealth.budgeted_percent}% of income. ${formatCurrency(categoryBudget)} category budgets + ${formatCurrency(savingsBudget)} savings budget = ${formatCurrency(budgetAmount)} total.`}
        />
        <FlowCard label="Saved This Month" value={formatCurrency(savedAmount)} note="Monthly savings budget" tone="savings" />
        <FlowCard label="Spent" value={formatCurrency(spentAmount)} note={`${budgetSummary.used_percent}% of budget`} />
        <FlowCard label="Remaining Budget" value={formatSignedCurrency(remainingBudget, "over")} note="Budgeted amount minus spending" tone={remainingBudget < 0 ? "warning" : "savings"} />
        <FlowCard
          label="Unallocated Income"
          value={formatSignedCurrency(unallocatedIncome, "over")}
          note="Income not assigned to budget"
          detail={`Monthly income (${formatCurrency(monthlyIncome)}) minus total planned budget (${formatCurrency(budgetAmount)}) = ${formatSignedCurrency(unallocatedIncome, "over")} unallocated.`}
          tone={unallocatedIncome < 0 ? "warning" : "default"}
        />
      </section>

      <section className="mt-5 rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Budget health</h2>
            <p className="text-xs text-slate-500">Monthly cash flow as a percentage of income or planned budget.</p>
          </div>
          <p className="text-xs text-slate-500">Income {formatCurrency(budgetHealth.income)}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <HealthRow label="Budgeted" amount={budgetAmount} percent={budgetHealth.budgeted_percent} color="#0f8a6b" />
          <HealthRow label="Spent" amount={spentAmount} percent={budgetHealth.spent_percent} color="#e8775d" />
          <HealthRow label="Saved" amount={savedAmount} percent={budgetHealth.saved_percent} color="#7db59c" />
          <HealthRow label="Remaining Budget" amount={Math.max(0, remainingBudget)} percent={budgetHealth.remaining_percent} color="#6fa3d2" />
        </div>
      </section>

      <section className="mt-5 rounded-[14px] border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Savings allocation</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Budget plans how much to save. Savings allocation plans where it goes. Goal progress stays on each savings goal card.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-mono text-xl font-bold text-brand-primary">{formatCurrency(savingsBudget)}</p>
            <p className="text-xs text-slate-500">planned for {monthLabel}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase text-slate-400">Monthly Savings Budget</p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-950">{formatCurrency(savingsBudget)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-slate-400">Goal Allocation</p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-950">{formatCurrency(goalAllocationTotal)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-slate-400">General Savings</p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-950">{formatCurrency(generalSavings)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-slate-400">Auto-distribute</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{savingsAutoDistribute ? "On" : "Off"}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          {remainingSavingsLabel}
          {unallocatedSavings > 0 ? `: ${formatCurrency(unallocatedSavings)} is not assigned to General Savings or goals yet.` : null}
        </div>

        {goalAllocations.length > 0 ? (
          <div className="mt-5 space-y-3">
            {goalAllocations.map((allocation) => (
              <div key={allocation.goal_id}>
                <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                  <span className="font-semibold text-slate-700">{allocation.title}</span>
                  <span className="font-mono text-slate-500">{formatCurrency(allocation.amount)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-brand-primary" style={{ width: `${savingsBudget ? Math.min(100, (allocation.amount / savingsBudget) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            {activeGoals.length > 0 && !savingsAutoDistribute ? "Turn on auto-distribute to plan goal allocations from active savings goals." : "No active savings goals to receive a goal allocation."}
          </p>
        )}
      </section>

      <section className="mt-5 rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Category budgets</h2>
          <p className="text-xs text-slate-500">Use Edit Budget to adjust</p>
        </div>
        <div className="space-y-4">
          {spendingCategories.length === 0 ? (
            <p className="text-sm text-slate-500">No spending categories yet. Add category budgets from Edit Budget.</p>
          ) : null}
          {spendingCategories.map((category) => {
            const percent = category.percent;
            const deficit = Math.max(0, category.spent - category.budget);
            const needsReview = deficit > 0;

            return (
              <div key={category.id}>
                <div className="mb-2 grid grid-cols-[1fr_auto_auto] items-center gap-4 text-xs">
                  <CategoryBadge category={category.name} compact />
                  <span className="font-mono text-slate-500">{formatCurrency(category.spent)} / {formatCurrency(category.budget)}</span>
                  <span className="font-mono text-[#3f7d16]">{percent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, percent)}%`, backgroundColor: "#c57a12" }} />
                </div>
                {needsReview ? <p className="mt-2 text-[11px] font-medium text-red-600">This category is short by {formatCurrency(deficit)} this month.</p> : null}
              </div>
            );
          })}
        </div>
      </section>
        </>
      ) : null}
      <BudgetFormPanel open={budgetDialog.isOpen} onClose={budgetDialog.close} onSuccess={refetchBudgetAndGoals} budgetSummary={budgetSummary} />
    </DashboardShell>
  );
}
