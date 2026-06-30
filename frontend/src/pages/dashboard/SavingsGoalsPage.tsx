import type { Session } from "@supabase/supabase-js";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useSavingsGoals } from "../../hooks/useSavingsGoals";
import { formatCurrency, formatMonthYear } from "../../utils/formatters";

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

export function SavingsGoalsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = getDisplayName(session);
  const { data: savingsGoals, isLoading, error } = useSavingsGoals();
  const goals = savingsGoals ?? [];

  return (
    <DashboardShell
      activeLabel="Savings Goals"
      title="Savings Goals"
      name={name}
      onSignOut={onSignOut}
      action={<button type="button" className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"><span className="text-xl leading-none">+</span>Create goal</button>}
    >
      {isLoading ? <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading savings goals...</div> : null}
      {error ? <div className="rounded-[14px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
      {!isLoading && !error && goals.length === 0 ? <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">No savings goals yet. Create your first goal to track progress.</div> : null}
      {!isLoading && !error && goals.length > 0 ? (
      <section className="grid gap-4 md:grid-cols-2">
        {goals.map((goal) => {
          const currentAmount = Number(goal.current_amount);
          const targetAmount = Number(goal.target_amount);
          const monthlyTarget = Number(goal.monthly_target);
          const percent = targetAmount ? Math.round((currentAmount / targetAmount) * 100) : 0;
          const needed = Math.max(0, targetAmount - currentAmount);

          return (
            <article key={goal.id} className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="text-xl leading-none">{goal.emoji}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-slate-950">{goal.title}</h2>
                  <p className="text-xs text-slate-500">Deadline: {formatMonthYear(goal.deadline)}</p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between gap-4">
                <p className="font-mono text-xs text-slate-950">{formatCurrency(currentAmount)} <span className="font-sans text-slate-500">of</span> {formatCurrency(targetAmount)}</p>
                <p className="font-mono text-xs font-bold text-brand-primary">{percent}%</p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-brand-primary" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-3 text-xs text-slate-500">{formatCurrency(needed)} pa kailangan - {formatCurrency(monthlyTarget)}/month</p>
            </article>
          );
        })}
      </section>
      ) : null}
    </DashboardShell>
  );
}
