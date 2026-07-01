import type { Session } from "@supabase/supabase-js";
import { BudgetFormPanel } from "../../components/forms/FinancialActionPanels";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useActionDialog } from "../../hooks/useActionDialog";
import { useBudget } from "../../hooks/useBudget";
import { formatCurrency } from "../../utils/formatters";

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

function MonthPicker() {
  return (
    <div className="inline-flex h-9 items-center gap-4 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-950 shadow-sm">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
      <span>June 2025</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
    </div>
  );
}

export function BudgetPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = getDisplayName(session);
  const editBudgetDialog = useActionDialog("edit-budget");
  const { data: budgetSummary, isLoading, error, refetch } = useBudget();

  return (
    <DashboardShell
      activeLabel="Budget"
      title="Budget"
      subtitle="Monthly plan - June 2025"
      name={name}
      onSignOut={onSignOut}
      secondaryAction={<MonthPicker />}
      action={
        <button
          type="button"
          onClick={editBudgetDialog.open}
          disabled={isLoading || !budgetSummary}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 3 5 5L8 21H3v-5L16 3Z" /></svg>Edit budget
        </button>
      }
    >
      {isLoading ? <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading budget...</div> : null}
      {error ? <div className="rounded-[14px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
      {!isLoading && !error && !budgetSummary ? <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">No budget data available yet.</div> : null}
      {budgetSummary ? (
        <>
      <section className="rounded-[14px] border border-emerald-200 bg-[#dff4ed] p-4 text-sm text-brand-dark">
        <div className="flex gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-primary text-white">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" /></svg>
          </span>
          <div>
            <h2 className="font-semibold">Alalay budget tip</h2>
            <p className="mt-1 text-xs leading-5 text-slate-700">
              You are on track for your lower-spend categories this month. Consider moving {formatCurrency(budgetSummary.suggested_savings_move)} from unused budget to savings - mabuting ugali yan!
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.8fr]">
        <article className="grid place-items-center rounded-[14px] border border-slate-200 bg-white p-7 text-center shadow-sm">
          <div className="grid h-32 w-32 place-items-center rounded-full border-[12px] border-[#c57a12]">
            <div>
              <p className="text-2xl font-bold text-slate-950">{budgetSummary.used_percent}%</p>
              <p className="text-xs text-slate-500">used</p>
            </div>
          </div>
          <p className="mt-6 text-xs text-slate-500">of {formatCurrency(budgetSummary.total_budget)} budget</p>
        </article>

        <div className="grid gap-3">
          <article className="rounded-[14px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Total budget</p>
              <div className="text-right"><p className="font-mono text-lg font-bold">{formatCurrency(budgetSummary.total_budget)}</p><p className="text-xs text-slate-500">Set for this month</p></div>
            </div>
          </article>
          <article className="rounded-[14px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Total spent</p>
              <div className="text-right"><p className="font-mono text-lg font-bold">{formatCurrency(budgetSummary.total_spent)}</p><p className="text-xs text-slate-500">{budgetSummary.used_percent}% of budget</p></div>
            </div>
          </article>
          <article className="rounded-[14px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Remaining</p>
              <div className="text-right"><p className="font-mono text-lg font-bold text-[#3f7d16]">{formatCurrency(budgetSummary.remaining)}</p><p className="text-xs text-slate-500">Still available</p></div>
            </div>
          </article>
        </div>
      </section>

      <section className="mt-5 rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Category budgets</h2>
          <p className="text-xs text-slate-500">Click a row to adjust</p>
        </div>
        <div className="space-y-4">
          {budgetSummary.categories.map((category) => {
            const percent = category.goal ? 76 : category.percent;

            return (
              <div key={category.id}>
                <div className="mb-2 grid grid-cols-[1fr_auto_auto] items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-3 font-semibold"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />{category.name}</span>
                  <span className="font-mono text-slate-500">{category.goal ? `- / ${formatCurrency(0)}` : `${formatCurrency(category.spent)} / ${formatCurrency(category.budget)}`}</span>
                  <span className={`font-mono ${category.goal ? "text-brand-primary" : "text-[#3f7d16]"}`}>{category.goal ? "Goal" : `${percent}%`}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full" style={{ width: `${percent}%`, backgroundColor: category.id === "savings" ? "#0f8a6b" : "#c57a12" }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
        </>
      ) : null}
      <BudgetFormPanel
        open={editBudgetDialog.isOpen}
        onClose={editBudgetDialog.close}
        onSuccess={refetch}
        categories={budgetSummary?.categories ?? []}
      />
    </DashboardShell>
  );
}
