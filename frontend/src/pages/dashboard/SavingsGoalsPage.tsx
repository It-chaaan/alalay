import type { Session } from "@supabase/supabase-js";
import { useState } from "react";
import { SavingsGoalFormPanel, SavingsGoalProgressPanel } from "../../components/forms/FinancialActionPanels";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { PageSkeleton, SlowLoadNotice } from "../../components/ui/Skeleton";
import { useActionDialog } from "../../hooks/useActionDialog";
import { useSavingsDashboard } from "../../hooks/useSavingsGoals";
import type { SavingsGoal } from "../../hooks/types";
import { formatCurrency, formatMonthYear } from "../../utils/formatters";

function displayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

export function SavingsGoalsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const { data, isLoading, isSlowLoading, error, refetch } = useSavingsDashboard();
  const createDialog = useActionDialog("create-goal");
  const progressDialog = useActionDialog("update-goal-progress");
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);

  return (
    <DashboardShell activeLabel="Savings Goals" title="Savings" subtitle="Overview and goal progress" name={displayName(session)} onSignOut={onSignOut} action={<button type="button" onClick={createDialog.open} className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white">+ Create goal</button>}>
      {isLoading ? <><PageSkeleton kind="budget" /><SlowLoadNotice show={isSlowLoading} /></> : null}
      {error ? <div className="rounded-[14px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
      {data ? <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Total savings</p><p className="mt-3 font-mono text-xl font-bold text-brand-primary">{formatCurrency(data.overview.totalSavings)}</p></article>
          <article className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Goal savings</p><p className="mt-3 font-mono text-xl font-bold">{formatCurrency(data.overview.goalSavings)}</p></article>
          <article className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Active goals</p><p className="mt-3 font-mono text-xl font-bold">{data.overview.activeGoals}</p></article>
          <article className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Monthly contribution</p><p className="mt-3 font-mono text-xl font-bold">{formatCurrency(data.overview.monthlyContribution)}</p></article>
        </section>
        <section className="mt-5">
          <h2 className="text-sm font-semibold">Savings goals</h2>
          {data.goals.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No savings goals yet. Create your first goal to track progress.</p> : <div className="mt-4 grid gap-4 md:grid-cols-2">{data.goals.map((goal) => { const current = Number(goal.current_amount); const target = Number(goal.target_amount); const percent = target ? Math.min(100, Math.round((current / target) * 100)) : 0; return <article key={goal.id} className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{goal.emoji} {goal.title}</h3><p className="mt-1 text-xs text-slate-500">Due {formatMonthYear(goal.deadline)}</p></div><span className="font-mono text-xs text-brand-primary">{percent}%</span></div><p className="mt-4 font-mono text-xs">{formatCurrency(current)} / {formatCurrency(target)}</p><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-primary" style={{ width: `${percent}%` }} /></div><button type="button" disabled={percent >= 100} onClick={() => { setSelectedGoal(goal); progressDialog.open(); }} className="mt-4 rounded-full bg-brand-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Add money</button></article>; })}</div>}
        </section>
      </> : null}
      <SavingsGoalFormPanel open={createDialog.isOpen} onClose={createDialog.close} onSuccess={refetch} />
      <SavingsGoalProgressPanel open={progressDialog.isOpen} onClose={progressDialog.close} onSuccess={refetch} goal={selectedGoal} />
    </DashboardShell>
  );
}
