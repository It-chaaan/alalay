import type { Session } from "@supabase/supabase-js";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useExpenses } from "../../hooks/useExpenses";
import { formatCurrency, formatDateShort } from "../../utils/formatters";

export function ExpensesPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Juan";
  const { data: expenses, isLoading, error } = useExpenses();
  const items = expenses ?? [];
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
  const categories = Array.from(new Set(items.map((item) => item.category)));

  return (
    <DashboardShell
      activeLabel="Expenses"
      title="Expenses"
      name={name}
      onSignOut={onSignOut}
      secondaryAction={<button className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium">Scan receipt</button>}
      action={<button className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"><span className="text-lg leading-none">+</span> Log expense</button>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Total spent" value={formatCurrency(total)} />
        <Stat label="Categories" value={String(categories.length)} accent="text-green-600" />
        <Stat label="Transactions" value={String(items.length)} accent="text-amber-600" />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Spending by category</h2>
        <div className="mt-4 flex h-8 overflow-hidden rounded-full">
          {categories.length ? categories.map((category, index) => {
            const amount = items.filter((item) => item.category === category).reduce((sum, item) => sum + Number(item.amount), 0);
            const colors = ["bg-[#e77c5e]", "bg-[#7aa2cc]", "bg-[#8ab39c]", "bg-[#f2c87c]", "bg-[#a38eb8]", "bg-[#c9b8a3]"];
            return <div key={category} className={colors[index % colors.length]} style={{ width: `${total ? (amount / total) * 100 : 0}%` }} />;
          }) : <div className="w-full bg-slate-100" />}
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {isLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading expenses...</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
        {!isLoading && !error && items.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">No expenses yet. Log an expense to start seeing your spending.</div> : null}
        {items.map((item) => (
          <div key={item.id}>
            <div className="mb-2 text-sm text-slate-500">{formatDateShort(item.date)}</div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 p-4 last:border-0">
                <div>
                  <div className="font-medium">{item.merchant}</div>
                  <div className="mt-1 flex gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2 py-0.5">{item.category}</span><span className="rounded-full bg-slate-100 px-2 py-0.5">{item.payment_method}</span></div>
                </div>
                <div className="font-mono font-semibold">{formatCurrency(Number(item.amount))}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className={`mt-2 text-2xl font-bold ${accent || ""}`}>{value}</div></div>;
}
