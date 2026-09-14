import type { Session } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { BudgetFormPanel } from "../../components/forms/FinancialActionPanels";
import { FinancialOverviewCard } from "../../components/dashboard/FinancialOverviewCard";
import { SectionToolbar } from "../../components/dashboard/SectionToolbar";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useActionDialog } from "../../hooks/useActionDialog";
import { useBudget } from "../../hooks/useBudget";
import { useIncomeSummary } from "../../hooks/useIncomeSummary";
import { useSavingsGoals } from "../../hooks/useSavingsGoals";
import type { BudgetSummary, SavingsGoal } from "../../hooks/types";
import { formatCurrency, formatSignedCurrency } from "../../utils/formatters";
import { CategoryIcon } from "../../components/ui/CategoryIcon";
import { PageSkeleton, SlowLoadNotice } from "../../components/ui/Skeleton";
import { SlideOver } from '../../components/ui/SlideOver';
import {
  copyPreviousBudgetCategories,
  mergeRecommendedBudgetCategories,
  previousBudgetMonth,
  type BudgetDraftCategory,
} from '../../utils/budgetSetups';
import { budgetCategoryStatus, type BudgetCategoryStatus } from '../../utils/budgetCategoryStatus';

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
    <div className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2 text-xs text-white shadow-none">
      <button type="button" onClick={onPrevious} className="grid h-7 w-7 place-items-center rounded-lg text-white/75 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70" aria-label="Previous month">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <span aria-live="polite">{label}</span>
      <button type="button" onClick={onNext} className="grid h-7 w-7 place-items-center rounded-lg text-white/75 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70" aria-label="Next month">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  );
}

function BudgetAction({ label, monthLabel, onOpen, disabled = false }: { label: string; monthLabel: string; onOpen: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      aria-label={`${label} for ${monthLabel}`}
      className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 3 5 5L8 21H3v-5L16 3Z" /></svg>
      {label}
    </button>
  );
}

type BudgetSetup = 'copy' | 'recommended' | 'custom';

function BudgetSetupPicker({
  open,
  monthLabel,
  isLoadingPrevious,
  canCopyPrevious,
  previousError,
  onClose,
  onSelect,
}: {
  open: boolean;
  monthLabel: string;
  isLoadingPrevious: boolean;
  canCopyPrevious: boolean;
  previousError: string | null;
  onClose: () => void;
  onSelect: (setup: BudgetSetup) => void;
}) {
  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Choose a starting setup"
      description={`Start with an editable plan for ${monthLabel}. Nothing is saved until you review the budget.`}
    >
      <div className="space-y-3">
        <button type="button" disabled={isLoadingPrevious || !canCopyPrevious} onClick={() => onSelect('copy')} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-55 dark:border-slate-700 dark:bg-slate-800">
          <span className="block text-sm font-semibold text-slate-950 dark:text-white">Copy last month</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-300">
            {isLoadingPrevious ? 'Loading the previous month…' : previousError ? 'We could not load the previous budget. Please try again.' : canCopyPrevious ? 'Reuse the previous month’s categories and planned amounts.' : 'No previous budget is available to copy.'}
          </span>
        </button>
        <button type="button" onClick={() => onSelect('recommended')} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-slate-700 dark:bg-slate-800">
          <span className="block text-sm font-semibold text-slate-950 dark:text-white">Recommended budget setup</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-300">Build an editable plan based on your income and spending.</span>
          <span className="mt-2 block text-xs font-semibold text-brand-primary">50% Needs · 30% Wants · 20% Savings</span>
        </button>
        <button type="button" onClick={() => onSelect('custom')} className="w-full rounded-2xl border border-brand-primary bg-brand-primary/5 p-4 text-left transition hover:bg-brand-primary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:bg-brand-primary/15">
          <span className="block text-sm font-semibold text-brand-primary">Custom</span>
          <span className="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-300">Start with no template allocations and build your own plan.</span>
        </button>
      </div>
    </SlideOver>
  );
}

function ReplaceBudgetSetupDialog({ open, monthLabel, isConfirming, onClose, onConfirm }: { open: boolean; monthLabel: string; isConfirming: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <SlideOver open={open} onClose={onClose} title="Replace this budget setup?" description={`This will replace the current category allocations for ${monthLabel}. This action will only be saved after you review and save the budget.`}>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
        <button type="button" disabled={isConfirming} onClick={onConfirm} className="min-h-11 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-60">Replace setup</button>
      </div>
    </SlideOver>
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

const categoryStatusStyle: Record<BudgetCategoryStatus, { bar: string; badge: string; label: string }> = {
  no_spending: { bar: 'bg-slate-400 dark:bg-slate-500', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', label: 'No spending yet' },
  on_track: { bar: 'bg-emerald-600 dark:bg-emerald-400', badge: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200', label: 'On track' },
  near_limit: { bar: 'bg-amber-500 dark:bg-amber-400', badge: 'bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200', label: 'Near limit' },
  fully_used: { bar: 'bg-amber-600 dark:bg-amber-400', badge: 'bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100', label: 'Fully used' },
  over_budget: { bar: 'bg-red-600 dark:bg-red-400', badge: 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200', label: 'Over budget' },
  unallocated: { bar: 'bg-slate-300 dark:bg-slate-600', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', label: 'No budget allocated' },
};

export function BudgetPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = getDisplayName(session);
  const budgetDialog = useActionDialog("budget");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const { data: fetchedBudgetSummary, isLoading, isSlowLoading, error, refetch } = useBudget(selectedMonth);
  const previousMonth = previousBudgetMonth(selectedMonth);
  const { data: previousBudgetSummary, isLoading: isLoadingPreviousBudget, error: previousBudgetError } = useBudget(previousMonth);
  const { data: incomeSummary } = useIncomeSummary(selectedMonth);
  const { data: savingsGoals, refetch: refetchSavingsGoals } = useSavingsGoals();
  const [optimisticBudgetSummary, setOptimisticBudgetSummary] = useState<BudgetSummary | null>(null);
  const [setupPickerOpen, setSetupPickerOpen] = useState(false);
  const [pendingSetup, setPendingSetup] = useState<BudgetSetup | null>(null);
  const [setupMonth, setSetupMonth] = useState<string | null>(null);
  const [draftCategories, setDraftCategories] = useState<BudgetDraftCategory[] | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const [draftMonth, setDraftMonth] = useState(selectedMonth);
  const setupTriggerRef = useRef<HTMLButtonElement>(null);
  const replacementInFlightRef = useRef(false);
  const [isConfirmingReplacement, setIsConfirmingReplacement] = useState(false);
  const budgetSummary = optimisticBudgetSummary ?? fetchedBudgetSummary;
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

  useEffect(() => {
    // A form or picker can never submit a setup after the user has moved to another month.
    budgetDialog.close();
    setSetupPickerOpen(false);
    setPendingSetup(null);
    setSetupMonth(null);
    replacementInFlightRef.current = false;
    setIsConfirmingReplacement(false);
  }, [selectedMonth]);

  function openBudgetEditor() {
    setDraftCategories(null);
    setDraftMonth(selectedMonth);
    budgetDialog.open();
  }

  function openSetupPicker() {
    setSetupMonth(selectedMonth);
    setSetupPickerOpen(true);
  }

  function applySetup(setup: BudgetSetup, targetMonth: string) {
    if (targetMonth !== selectedMonth) return;
    const currentCategories = budgetSummary?.categories.filter((category) => !category.goal).map((category) => ({ id: category.id, name: category.name, budget: category.budget })) ?? [];
    const nextCategories = setup === 'copy'
      ? copyPreviousBudgetCategories(previousBudgetSummary?.categories ?? [])
      : setup === 'recommended'
        ? mergeRecommendedBudgetCategories(currentCategories, Number(budgetSummary?.budget_amount ?? 0))
        : [];
    setDraftCategories(nextCategories);
    setDraftKey((value) => value + 1);
    setDraftMonth(targetMonth);
    setPendingSetup(null);
    setSetupMonth(null);
    budgetDialog.open();
  }

  function chooseSetup(setup: BudgetSetup) {
    const targetMonth = setupMonth;
    if (!targetMonth || targetMonth !== selectedMonth) return;
    if (setup === 'copy' && !previousBudgetSummary?.categories.some((category) => !category.goal)) return;
    setSetupPickerOpen(false);
    const hasCurrentPlan = Boolean(budgetSummary?.categories.some((category) => !category.goal));
    if (hasCurrentPlan) {
      replacementInFlightRef.current = false;
      setIsConfirmingReplacement(false);
      setPendingSetup(setup);
      return;
    }
    applySetup(setup, targetMonth);
  }

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
      subtitle="Plan how your monthly income is allocated"
      name={name}
      onSignOut={onSignOut}
    >
{isLoading ? <><PageSkeleton kind="budget" /><SlowLoadNotice show={isSlowLoading} /></> : null}
      {error ? <div className="rounded-[14px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
      {!isLoading && !error && !budgetSummary ? (
        <section className="mt-5">
          <SectionToolbar title="Budget plan">
            <div className="flex flex-wrap items-center gap-2"><button ref={setupTriggerRef} type="button" onClick={openSetupPicker} className="inline-flex h-9 items-center rounded-xl border border-brand-primary px-3 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary">Choose a starting setup</button><BudgetAction label="Create Budget" monthLabel={monthLabel} onOpen={openBudgetEditor} /></div>
          </SectionToolbar>
          <div className="mt-4 rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">No budget has been created yet. Start by setting your category allocations.</div>
        </section>
      ) : null}
      {budgetSummary ? (
        <>
      <FinancialOverviewCard
        label="Budget overview"
        period={<MonthPicker label={monthLabel} onPrevious={() => setSelectedMonth((month) => addMonthsToMonthKey(month, -1))} onNext={() => setSelectedMonth((month) => addMonthsToMonthKey(month, 1))} />}
        primary={formatSignedCurrency(remainingBudget, "over")}
        primaryLabel="Remaining budget"
        metrics={[
          { label: "Monthly income", value: formatCurrency(monthlyIncome) },
          { label: "Budgeted amount", value: formatCurrency(budgetAmount) },
          { label: "Spent", value: formatCurrency(spentAmount) },
          { label: "Unallocated income", value: formatSignedCurrency(unallocatedIncome, "over") },
          { label: "Saved this month", value: formatCurrency(savedAmount) },
        ]}
      />

      <section className="mt-5 rounded-[14px] border border-emerald-200 bg-[#dff4ed] p-4 text-sm text-brand-dark dark:border-emerald-700 dark:bg-[#1d3a30] dark:text-brand-muted">
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

      <section className="mt-5">
        <SectionToolbar title="Category budgets" count={spendingCategories.length}>
          <div className="flex flex-wrap items-center gap-2"><button ref={setupTriggerRef} type="button" onClick={openSetupPicker} className="inline-flex h-9 items-center rounded-xl border border-brand-primary px-3 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary">Choose a starting setup</button><BudgetAction label="Edit Budget" monthLabel={monthLabel} onOpen={openBudgetEditor} disabled={isLoading} /></div>
        </SectionToolbar>
        <div className="mt-4 rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-4">
          {spendingCategories.length === 0 ? (
            <p className="text-sm text-slate-500">No spending categories yet. Add category budgets from Edit Budget.</p>
          ) : null}
          {spendingCategories.map((category) => {
            const budgetState = budgetCategoryStatus(category.spent, category.budget);
            const style = categoryStatusStyle[budgetState.status];
            const remainingCopy = budgetState.status === 'over_budget'
              ? `${formatCurrency(Math.abs(budgetState.remaining))} over budget`
              : budgetState.status === 'unallocated'
                ? 'No budget allocated'
                : `${formatCurrency(Math.max(0, budgetState.remaining))} left${budgetState.status === 'fully_used' ? ' • Fully used' : budgetState.status === 'no_spending' ? ' • No spending yet' : budgetState.status === 'near_limit' ? ' • Near limit' : ' • On track'}`;

            return (
              <div key={category.id} className="rounded-xl border border-slate-200 bg-white px-4 py-4 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 items-center gap-3 sm:w-48 sm:shrink-0">
                    <CategoryIcon category={category.name} />
                    <span className="truncate text-sm font-semibold text-slate-950 dark:text-white">{category.name}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3 text-xs sm:hidden"><span className={`rounded-full px-2 py-1 font-semibold ${style.badge}`}>{style.label}</span><span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{budgetState.budget ? `${budgetState.percent}%` : '—'}</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-label={`${category.name}: ${style.label}. ${formatCurrency(budgetState.spent)} spent of ${formatCurrency(budgetState.budget)}.`} aria-valuemin={0} aria-valuemax={Math.max(1, budgetState.budget)} aria-valuenow={Math.min(budgetState.spent, Math.max(1, budgetState.budget))} aria-valuetext={`${budgetState.budget ? `${budgetState.percent}% used` : 'No budget allocated'}. ${remainingCopy}`}>
                      <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${budgetState.progress}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:w-56 sm:shrink-0 sm:justify-end">
                    <div className="min-w-0 text-left sm:text-right"><p className="whitespace-nowrap font-mono text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(budgetState.spent)} of {formatCurrency(budgetState.budget)}</p><p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{remainingCopy}</p></div>
                    <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${style.badge}`}>{budgetState.budget ? `${budgetState.percent}% · ${style.label}` : style.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </section>
        </>
      ) : null}
      <BudgetSetupPicker open={setupPickerOpen} monthLabel={monthLabel} isLoadingPrevious={isLoadingPreviousBudget} canCopyPrevious={Boolean(previousBudgetSummary?.categories.some((category) => !category.goal))} previousError={previousBudgetError} onClose={() => { setSetupPickerOpen(false); setSetupMonth(null); }} onSelect={chooseSetup} />
      <ReplaceBudgetSetupDialog open={Boolean(pendingSetup)} monthLabel={getMonthLabel(setupMonth ?? selectedMonth)} isConfirming={isConfirmingReplacement} onClose={() => { replacementInFlightRef.current = false; setIsConfirmingReplacement(false); setPendingSetup(null); setSetupMonth(null); setupTriggerRef.current?.focus(); }} onConfirm={() => { if (replacementInFlightRef.current || !pendingSetup || !setupMonth) return; replacementInFlightRef.current = true; setIsConfirmingReplacement(true); applySetup(pendingSetup, setupMonth); }} />
      <BudgetFormPanel open={budgetDialog.isOpen} onClose={budgetDialog.close} onSuccess={refetchBudgetAndGoals} budgetSummary={budgetSummary} month={draftMonth} initialCategories={draftCategories} draftKey={draftKey} />
    </DashboardShell>
  );
}
