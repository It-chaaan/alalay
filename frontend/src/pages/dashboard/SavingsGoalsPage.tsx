import type { Session } from "@supabase/supabase-js";
import { useState } from "react";
import { SavingsGoalFormPanel, SavingsGoalProgressPanel } from "../../components/forms/FinancialActionPanels";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useActionDialog } from "../../hooks/useActionDialog";
import { useSavingsGoals } from "../../hooks/useSavingsGoals";
import type { SavingsGoal } from "../../hooks/types";
import { formatCurrency, formatMonthYear } from "../../utils/formatters";

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

function monthsUntil(deadline: string) {
  const targetDate = new Date(`${deadline}T00:00:00`);
  const today = new Date();
  const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / 86400000);

  return Math.max(1, Math.ceil(diffDays / 30));
}

function getMonthlyNeeded(currentAmount: number, targetAmount: number, deadline: string) {
  const remaining = Math.max(0, targetAmount - currentAmount);

  if (!remaining) {
    return 0;
  }

  return remaining / monthsUntil(deadline);
}

export function SavingsGoalsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = getDisplayName(session);
  const createGoalDialog = useActionDialog("create-goal");
  const editGoalDialog = useActionDialog("edit-goal");
  const progressGoalDialog = useActionDialog("update-goal-progress");
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const { data: savingsGoals, isLoading, error, refetch } = useSavingsGoals();
  const goals = savingsGoals ?? [];

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
      title="Savings Goals"
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
      {isLoading ? <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading savings goals...</div> : null}
      {error ? <div className="rounded-[14px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
      {!isLoading && !error && goals.length === 0 ? <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">No savings goals yet. Create your first goal to track progress.</div> : null}
      {!isLoading && !error && goals.length > 0 ? (
      <section className="grid gap-4 md:grid-cols-2">
        {goals.map((goal) => {
          const currentAmount = Number(goal.current_amount);
          const targetAmount = Number(goal.target_amount);
          const monthlyContribution = Number(goal.monthly_target);
          const percent = targetAmount ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
          const needed = Math.max(0, targetAmount - currentAmount);
          const monthlyNeeded = getMonthlyNeeded(currentAmount, targetAmount, goal.deadline);
          const isComplete = Boolean(goal.completed_at) || needed <= 0;

          return (
            <article key={goal.id} className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-primary/10 text-xl leading-none">{goal.emoji}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-slate-950">{goal.title}</h2>
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
      </section>
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
