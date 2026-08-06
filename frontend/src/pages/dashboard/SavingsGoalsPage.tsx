import type { Session } from "@supabase/supabase-js";
import { useState } from "react";
import { SavingsGoalFormPanel, SavingsGoalProgressPanel } from "../../components/forms/FinancialActionPanels";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useActionDialog } from "../../hooks/useActionDialog";
import { useSavingsDashboard } from "../../hooks/useSavingsGoals";
import type { SavingsDashboard, SavingsGoal } from "../../hooks/types";
import { formatCurrency, formatMonthYear } from "../../utils/formatters";
import { getMonthlyNeeded, getProjectedGoalDate } from "../../utils/savingsGoals";
import { PageSkeleton, SlowLoadNotice } from "../../components/ui/Skeleton";

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

function formatProjectedDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}

function EmptyPanel({ children }: { children: string }) {
  return <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">{children}</div>;
}

function OverviewCard({ label, value, note, tone = "default" }: { label: string; value: string; note?: string; tone?: "default" | "savings" | "income" }) {
  return (
    <article className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-3 font-mono text-xl font-bold ${tone === "savings" ? "text-brand-primary" : tone === "income" ? "text-[#3f7d16]" : "text-slate-950"}`}>{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </article>
  );
}

function SavingsOverview({ dashboard }: { dashboard: SavingsDashboard }) {
  const overview = dashboard.overview;

  return (
    <section>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Savings Overview</h2>
          <p className="mt-1 text-xs text-slate-500">Overall savings before individual goals.</p>
        </div>
        <p className="text-xs text-slate-500">{overview.savingsRate > 0 ? `${overview.savingsRate}% planned monthly savings rate` : "Set a monthly savings budget to track savings rate"}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewCard label="Total Savings" value={formatCurrency(overview.totalSavings)} note="Goal savings plus general savings" tone="savings" />
        <OverviewCard label="Goal Savings" value={formatCurrency(overview.goalSavings)} note="Saved inside goal balances" />
        <OverviewCard label="General Savings" value={formatCurrency(overview.generalSavings)} note="Not assigned to a specific goal" tone="income" />
        <OverviewCard label="Active Goals" value={String(overview.activeGoals)} />
        <OverviewCard label="Completed Goals" value={String(overview.completedGoals)} />
        <OverviewCard label="Monthly Contribution" value={formatCurrency(overview.monthlyContribution)} note="Budgeted or goal target total" />
      </div>
    </section>
  );
}

function SavingsBreakdown({ dashboard }: { dashboard: SavingsDashboard }) {
  const total = Math.max(1, dashboard.overview.totalSavings);

  return (
    <section className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <article className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-950">Savings Breakdown</h2>
        <div className="mt-5 space-y-4">
          {dashboard.breakdown.map((item, index) => {
            const colors = ["#0f8a6b", "#7db59c", "#6fa3d2", "#f2c87c"];
            const percent = Math.round((item.amount / total) * 100);

            return (
              <div key={item.key}>
                <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{item.label}</p>
                    <p className="mt-0.5 text-slate-500">{item.description}</p>
                  </div>
                  <p className="shrink-0 font-mono font-semibold text-slate-950">{formatCurrency(item.amount)}</p>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full" style={{ width: `${percent}%`, backgroundColor: colors[index % colors.length] }} />
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <article className="rounded-[14px] border border-emerald-200 bg-[#f0faf6] p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-950">General Savings</h2>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          General Savings is separate from goals and can later expand into dedicated savings categories.
        </p>
        <div className="mt-4 grid gap-2">
          {dashboard.futureSavingsTypes.map((type) => (
            <div key={type} className="rounded-xl bg-white/80 px-4 py-3 text-xs font-semibold text-slate-700">
              {type}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function SavingsInsight({ dashboard }: { dashboard: SavingsDashboard }) {
  if (!dashboard.aiInsight.message) {
    return null;
  }

  return (
    <section className="mt-5 rounded-[14px] border border-emerald-200 bg-[#dff4ed] p-4 text-sm text-brand-dark">
      <div className="flex gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-primary text-white">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" /></svg>
        </span>
        <div>
          <h2 className="font-semibold">AI savings insight</h2>
          <p className="mt-1 text-xs leading-5 text-slate-700">{dashboard.aiInsight.message}</p>
          <p className="mt-2 text-xs leading-5 text-slate-600">Recommendations only. You decide where money moves.</p>
        </div>
      </div>
    </section>
  );
}

export function SavingsGoalsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = getDisplayName(session);
  const createGoalDialog = useActionDialog("create-goal");
  const editGoalDialog = useActionDialog("edit-goal");
  const progressGoalDialog = useActionDialog("update-goal-progress");
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const { data: dashboard, isLoading, isSlowLoading, error, refetch } = useSavingsDashboard();
  const goals = dashboard?.goals ?? [];

  function openEditGoal(goal: SavingsGoal) {
    setSelectedGoal(goal);
    editGoalDialog.open();
  }

  function openProgressGoal(goal: SavingsGoal) {
    setSelectedGoal(goal);
    progressGoalDialog.open();
  }

  return (
    <DashboardShell
      activeLabel="Savings Goals"
      title="Savings"
      subtitle="Overview, general savings, and goal progress"
      name={name}
      onSignOut={onSignOut}
      action={
        <button
          type="button"
          onClick={createGoalDialog.open}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
        >
          <span className="text-xl leading-none">+</span>Create goal
        </button>
      }
    >
{isLoading ? <><PageSkeleton kind="budget" /><SlowLoadNotice show={isSlowLoading} /></> : null}
      {error ? <div className="rounded-[14px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
      {!isLoading && !error && !dashboard ? <EmptyPanel>No savings data available yet.</EmptyPanel> : null}

      {dashboard ? (
        <>
          <SavingsOverview dashboard={dashboard} />
          <SavingsBreakdown dashboard={dashboard} />
          <SavingsInsight dashboard={dashboard} />

          <section className="mt-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Savings Goals</h2>
                <p className="mt-1 text-xs text-slate-500">Goal-specific progress and manual updates.</p>
              </div>
              <p className="text-xs text-slate-500">{goals.length} goal{goals.length === 1 ? "" : "s"}</p>
            </div>

            {goals.length === 0 ? <EmptyPanel>No savings goals yet. Create your first goal to track progress.</EmptyPanel> : null}
            {goals.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {goals.map((goal) => {
                  const currentAmount = Number(goal.current_amount);
                  const targetAmount = Number(goal.target_amount);
                  const monthlyContribution = Number(goal.monthly_target);
                  const percent = targetAmount ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
                  const needed = Math.max(0, targetAmount - currentAmount);
                  const monthlyNeeded = getMonthlyNeeded(currentAmount, targetAmount, goal.deadline);
                  const isComplete = Boolean(goal.completed_at) || needed <= 0;
                  const isAhead = !isComplete && monthlyNeeded > 0 && monthlyContribution > monthlyNeeded * 1.1;
                  const isOnTrack = !isComplete && monthlyContribution >= monthlyNeeded;
                  const projectedDate = getProjectedGoalDate(currentAmount, targetAmount, monthlyContribution);

                  return (
                    <article key={goal.id} className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start gap-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-primary/10 text-xl leading-none">{goal.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-slate-950">{goal.title}</h3>
                          <p className="text-xs text-slate-500">Deadline: {formatMonthYear(goal.deadline)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isComplete ? "bg-emerald-100 text-brand-dark" : "bg-slate-100 text-slate-600"}`}>
                          {isComplete ? "Complete" : "Active"}
                        </span>
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-4">
                        <p className="font-mono text-xs text-slate-950">{formatCurrency(currentAmount)} <span className="font-sans text-slate-500">of</span> {formatCurrency(targetAmount)}</p>
                        <p className="font-mono text-xs font-bold text-brand-primary">{percent}%</p>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-brand-primary" style={{ width: `${percent}%` }} />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] uppercase text-slate-400">Remaining</p>
                          <p className="mt-1 font-mono text-xs font-semibold text-slate-950">{formatCurrency(needed)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase text-slate-400">Contribution</p>
                          <p className="mt-1 font-mono text-xs font-semibold text-slate-950">{formatCurrency(monthlyContribution)}/mo</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase text-slate-400">Needed</p>
                          <p className="mt-1 font-mono text-xs font-semibold text-slate-950">{formatCurrency(monthlyNeeded)}/mo</p>
                        </div>
                      </div>
                      {!isComplete ? (
                        <div className={`mt-4 rounded-xl border px-3 py-3 text-xs leading-5 ${isOnTrack ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                          <p className="font-semibold">{isOnTrack ? (isAhead ? "✅ Ahead of pace" : "✅ On track") : "⚠️ Behind pace"}</p>
                          {isOnTrack ? (
                            <p className="mt-1">{projectedDate ? `At this rate, you’ll reach your goal by ${formatProjectedDate(projectedDate)}.` : "Keep this contribution going to reach your goal."}</p>
                          ) : (
                            <p className="mt-1">{projectedDate ? `At this rate, you’ll reach your goal by ${formatProjectedDate(projectedDate)}. ` : "At this rate, this goal will not be reached. "}Increase contribution by {formatCurrency(monthlyNeeded - monthlyContribution)}/mo or extend the deadline to reach {formatCurrency(targetAmount)} by {formatMonthYear(goal.deadline)}.</p>
                          )}
                        </div>
                      ) : null}
                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openProgressGoal(goal)}
                          disabled={isComplete}
                          className="inline-flex min-h-10 items-center justify-center rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add Money
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditGoal(goal)}
                          className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      <SavingsGoalFormPanel
        open={createGoalDialog.isOpen}
        onClose={createGoalDialog.close}
        onSuccess={refetch}
      />
      <SavingsGoalFormPanel
        open={editGoalDialog.isOpen}
        onClose={editGoalDialog.close}
        onSuccess={refetch}
        goal={selectedGoal}
      />
      <SavingsGoalProgressPanel
        open={progressGoalDialog.isOpen}
        onClose={progressGoalDialog.close}
        onSuccess={refetch}
        goal={selectedGoal}
      />
    </DashboardShell>
  );
}
