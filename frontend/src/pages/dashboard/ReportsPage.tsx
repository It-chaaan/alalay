import type { Session } from "@supabase/supabase-js";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useReports } from "../../hooks/useReports";
import { formatCurrency } from "../../utils/formatters";

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

function PeriodTabs() {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white p-0.5 text-xs text-slate-500">
        {["This month", "Last month", "Q2 2025", "YTD"].map((tab, index) => (
          <button key={tab} type="button" className={`h-7 rounded-lg px-3 ${index === 0 ? "bg-brand-primary font-semibold text-white" : ""}`}>{tab}</button>
        ))}
      </div>
      <button type="button" className="inline-flex h-8 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 shadow-sm">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
        Export
      </button>
    </div>
  );
}

function SpendingLineChart({ values }: { values: number[] }) {
  const max = 1400;
  const width = 840;
  const height = 120;
  const safeValues = values.length > 1 ? values : [0, 0];
  const points = safeValues.map((value, index) => `${(index / (safeValues.length - 1)) * width},${height - (value / Math.max(max, ...safeValues)) * height}`).join(" ");

  return (
    <article className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold">Daily spending trend - June 2025</h2>
      <div className="mt-5 grid grid-cols-[44px_1fr]">
        <div className="flex h-32 flex-col justify-between pb-4 text-right text-xs text-slate-500">
          {[1400, 1050, 700, 350, 0].map((value) => <span key={value}>{formatCurrency(value)}</span>)}
        </div>
        <div className="relative h-32">
          {[0, 1, 2, 3, 4].map((line) => <div key={line} className="absolute left-0 right-0 border-t border-dashed border-slate-200" style={{ top: `${line * 25}%` }} />)}
          <svg viewBox={`0 0 ${width} ${height}`} className="relative z-10 h-28 w-full overflow-visible">
            <polyline fill="none" stroke="#0f6f57" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" points={points} />
          </svg>
          <div className="grid grid-cols-4 text-xs text-slate-500">
            <span>Jun 1</span><span>Jun 8</span><span>Jun 15</span><span>Jun 22</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function Donut({ categories }: { categories: Array<{ name: string; amount: number; color: string }> }) {
  let offset = 0;
  const total = categories.reduce((sum, item) => sum + item.amount, 0) || 1;

  return (
    <svg viewBox="0 0 42 42" className="h-40 w-40 -rotate-90">
      <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#eef0ec" strokeWidth="6" />
      {categories.map((category) => {
        const dash = (category.amount / total) * 100;
        const circle = <circle key={category.name} cx="21" cy="21" r="15.9" fill="transparent" stroke={category.color} strokeWidth="6" strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={-offset} />;
        offset += dash;
        return circle;
      })}
    </svg>
  );
}

export function ReportsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = getDisplayName(session);
  const { data: report, isLoading, error } = useReports();
  const palette = ["#e8775d", "#7db59c", "#6fa3d2", "#f2c87c", "#bdb2a5", "#9d90ac"];
  const categories = (report?.categories ?? []).map((category, index) => ({ ...category, color: palette[index % palette.length] }));

  return (
    <DashboardShell activeLabel="Reports" title="Reports" name={name} onSignOut={onSignOut} action={<PeriodTabs />}>
      {isLoading ? <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading reports...</div> : null}
      {error ? <div className="rounded-[14px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
      {!isLoading && !error && !report ? <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">No report data available yet.</div> : null}
      {report ? (
        <>
      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total income", value: report.total_income, tone: "income" },
          { label: "Total expenses", value: report.total_expenses, tone: "expense" },
          { label: "Net savings", value: report.net_savings, tone: "savings" },
          { label: "Savings rate", value: `${report.savings_rate}%`, note: "Current month", tone: "rate" },
        ].map((item) => (
          <article key={item.label} className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className={`mt-3 font-mono text-xl font-bold ${item.tone === "income" ? "text-[#3f7d16]" : item.tone === "savings" || item.tone === "rate" ? "text-brand-primary" : "text-slate-950"}`}>{typeof item.value === "number" ? formatCurrency(item.value) : item.value}</p>
            {item.note ? <p className={`mt-1 text-xs ${item.tone === "expense" ? "text-[#c57a12]" : "text-[#c57a12]"}`}>{item.note}</p> : null}
          </article>
        ))}
      </section>

      <section className="mt-5">
        <SpendingLineChart values={report.daily_spending.map((item) => item.amount)} />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Spending breakdown</h2>
          <div className="mt-6 grid place-items-center">
            <Donut categories={categories} />
          </div>
        </article>
        <article className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Category breakdown</h2>
          <div className="mt-5 space-y-4">
            {categories.map((category) => (
              <div key={category.name} className="grid grid-cols-[100px_1fr_auto] items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />{category.name}</span>
                <span className="h-1.5 rounded-full bg-slate-100"><span className="block h-1.5 rounded-full" style={{ width: `${(category.amount / 6200) * 100}%`, backgroundColor: category.color }} /></span>
                <span className="font-mono font-semibold">{formatCurrency(category.amount)}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
        </>
      ) : null}
    </DashboardShell>
  );
}
