import type { Session } from "@supabase/supabase-js";
import { CalendarDays, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useReports } from "../../hooks/useReports";
import type { ReportPeriod, ReportsSummary } from "../../hooks/types";
import { formatCurrency, formatDateShort, formatMonthYear, formatSignedCurrency } from "../../utils/formatters";
import { buildReportDateTicks, reportDateRatio } from "../../utils/reportChartDates";
import { getCategoryColor } from "../../utils/categoryColors";

const periodOptions: Array<{ label: string; value: ReportPeriod }> = [
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
  { label: "Last 3 months", value: "last_3_months" },
  { label: "Quarter", value: "quarter" },
  { label: "YTD", value: "ytd" },
  { label: "Custom", value: "custom" },
];

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

function toDateInputValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function getDefaultCustomRange() {
  const today = new Date();

  return {
    from: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toDateInputValue(today),
  };
}

function exportReport(report: ReportsSummary) {
  const rows = [
    ["Metric", "Value"],
    ["Date range", report.range.label],
    ["Total income", String(report.total_income)],
    ["Total expenses", String(report.total_expenses)],
    ["Net savings", String(report.net_savings)],
    ["Savings rate", `${report.savings_rate}%`],
    ["Budget utilization", `${report.budget_utilization}%`],
    ["Total bills paid", String(report.total_bills_paid)],
    ["Outstanding bills", String(report.outstanding_bills)],
    ["Subscription spending", String(report.subscription_spending)],
    ["Monthly savings budget", String(report.budget.monthly_savings_budget)],
    ["Goal allocation", String(report.budget.goal_allocation_total)],
    ["General savings", String(report.budget.general_savings)],
    [],
    ["Category", "Amount", "Percent"],
    ...report.categories.map((category) => [category.name, String(category.amount), `${category.percent}%`]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `alalay-report-${report.range.start}-to-${report.range.end}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function ReportControls({
  period,
  customRange,
  report,
  disabled,
  onPeriodChange,
  onCustomRangeChange,
}: {
  period: ReportPeriod;
  customRange: { from: string; to: string };
  report: ReportsSummary | null;
  disabled: boolean;
  onPeriodChange: (period: ReportPeriod) => void;
  onCustomRangeChange: (range: { from: string; to: string }) => void;
}) {
  return (
    <div className="flex max-w-full flex-col items-stretch gap-2 lg:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex min-h-9 flex-wrap items-center rounded-xl border border-slate-200 bg-white p-0.5 text-xs text-slate-500 shadow-sm">
          {periodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onPeriodChange(option.value)}
              className={`h-8 rounded-lg px-3 ${period === option.value ? "bg-brand-primary font-semibold text-white" : "hover:bg-slate-50"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => report ? exportReport(report) : undefined}
          disabled={!report || disabled}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download aria-hidden="true" className="h-4 w-4" />
          Export
        </button>
      </div>
      {period === "custom" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
          <CalendarDays aria-hidden="true" className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={customRange.from}
            onChange={(event) => onCustomRangeChange({ ...customRange, from: event.target.value })}
            className="h-8 rounded-lg border border-slate-200 px-2"
          />
          <span>to</span>
          <input
            type="date"
            value={customRange.to}
            onChange={(event) => onCustomRangeChange({ ...customRange, to: event.target.value })}
            className="h-8 rounded-lg border border-slate-200 px-2"
          />
        </div>
      ) : null}
    </div>
  );
}

function EmptyPanel({ children }: { children: string }) {
  return <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">{children}</div>;
}

function StatCard({ label, value, note, tone = "default" }: { label: string; value: string; note?: string; tone?: "default" | "income" | "savings" | "warning" }) {
  return (
    <article className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-3 font-mono text-xl font-bold ${tone === "income" ? "text-[#3f7d16]" : tone === "savings" ? "text-brand-primary" : tone === "warning" ? "text-[#c57a12]" : "text-slate-950"}`}>
        {value}
      </p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </article>
  );
}

function LineChart({ title, values, labelFormatter, dateRange }: { title: string; values: Array<{ date: string; amount: number }>; labelFormatter: (value: string) => string; dateRange?: { start: string; end: string } }) {
  const max = Math.max(1, ...values.map((item) => item.amount));
  const width = 840;
  const height = 120;
  const safeValues = values.length > 1 ? values : [{ date: "", amount: 0 }, { date: "", amount: 0 }];
  const points = safeValues.map((item, index) => {
    const x = dateRange && item.date ? reportDateRatio(item.date, dateRange.start, dateRange.end) * width : (index / (safeValues.length - 1)) * width;
    return `${x},${height - (item.amount / max) * height}`;
  }).join(" ");
  const ticks = [max, max * 0.75, max * 0.5, max * 0.25, 0];
  const dateTicks = dateRange ? buildReportDateTicks(dateRange.start, dateRange.end) : [];
  const labelValues = dateRange ? dateTicks : values.length > 1 ? [values[0]?.date, values[Math.floor((values.length - 1) / 2)]?.date, values[values.length - 1]?.date] : [values[0]?.date];

  return (
    <article className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold">{title}</h2>
      {values.length === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No spending activity in this date range.</p>
      ) : (
        <div className="mt-5 grid grid-cols-[52px_1fr]">
          <div className="flex h-32 flex-col justify-between pb-4 text-right text-[11px] text-slate-500">
            {ticks.map((value) => <span key={value}>{formatCurrency(value)}</span>)}
          </div>
          <div className="relative h-32 min-w-0">
            {[0, 1, 2, 3, 4].map((line) => <div key={line} className="absolute left-0 right-0 border-t border-dashed border-slate-200" style={{ top: `${line * 25}%` }} />)}
            <svg viewBox={`0 0 ${width} ${height}`} className="relative z-10 h-28 w-full overflow-visible">
              <polyline fill="none" stroke="#0f6f57" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" points={points} />
            </svg>
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              {labelValues.map((value, index) => <span key={`${value}-${index}`}>{value ? labelFormatter(value) : ""}</span>)}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function Donut({ categories }: { categories: Array<{ name: string; amount: number; color: string }> }) {
  let offset = 0;
  const total = categories.reduce((sum, item) => sum + item.amount, 0);

  return (
    <svg viewBox="0 0 42 42" className="h-40 w-40 -rotate-90">
      <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#eef0ec" strokeWidth="6" />
      {total > 0 ? categories.map((category) => {
        const dash = (category.amount / total) * 100;
        const circle = <circle key={category.name} cx="21" cy="21" r="15.9" fill="transparent" stroke={category.color} strokeWidth="6" strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={-offset} />;
        offset += dash;
        return circle;
      }) : null}
    </svg>
  );
}

function CategoryBreakdown({ categories }: { categories: Array<{ name: string; amount: number; percent: number; color: string }> }) {
  const max = Math.max(1, ...categories.map((category) => category.amount));

  return (
    <article className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold">Category breakdown</h2>
      <div className="mt-5 space-y-4">
        {categories.length === 0 ? <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No expense categories to report for this range.</p> : null}
        {categories.map((category) => (
          <div key={category.name} className="grid grid-cols-[minmax(92px,140px)_1fr_auto] items-center gap-4 text-xs">
            <span className="inline-flex min-w-0 items-center gap-3">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="truncate">{category.name}</span>
            </span>
            <span className="h-1.5 rounded-full bg-slate-100">
              <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(4, (category.amount / max) * 100)}%`, backgroundColor: category.color }} />
            </span>
            <span className="font-mono font-semibold">{formatCurrency(category.amount)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function ComparisonBars({ title, rows }: { title: string; rows: Array<{ name: string; budget: number; actual: number }> }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.budget, row.actual]));

  return (
    <article className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-5 space-y-4">
        {rows.length === 0 ? <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">Create a budget to compare planned and actual spending.</p> : null}
        {rows.slice(0, 8).map((row) => (
          <div key={row.name}>
            <div className="mb-2 flex items-center justify-between gap-4 text-xs">
              <span className="truncate font-semibold text-slate-700">{row.name}</span>
              <span className="font-mono text-slate-500">{formatCurrency(row.actual)} / {formatCurrency(row.budget)}</span>
            </div>
            <div className="grid gap-1">
              <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-[#bdb2a5]" style={{ width: `${(row.budget / max) * 100}%` }} /></div>
              <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-brand-primary" style={{ width: `${(row.actual / max) * 100}%` }} /></div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function Timeline({ title, empty, rows }: { title: string; empty: string; rows: Array<{ date: string; amount: number; label: string; status?: string }> }) {
  return (
    <article className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-5 space-y-3">
        {rows.length === 0 ? <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">{empty}</p> : null}
        {rows.slice(0, 6).map((row) => (
          <div key={`${row.date}-${row.label}-${row.amount}`} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3 text-xs">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-800">{row.label}</p>
              <p className="mt-0.5 text-slate-500">{formatDateShort(row.date)}{row.status ? ` - ${row.status}` : ""}</p>
            </div>
            <p className="shrink-0 font-mono font-semibold">{formatCurrency(row.amount)}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

export function ReportsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = getDisplayName(session);
  const defaultCustomRange = useMemo(getDefaultCustomRange, []);
  const [period, setPeriod] = useState<ReportPeriod>("this_month");
  const [customRange, setCustomRange] = useState(defaultCustomRange);
  const { data: report, isLoading, error } = useReports({ period, ...customRange });
  const categories = (report?.categories ?? []).map((category, index) => ({ ...category, color: getCategoryColor(category.name, index) }));
  const hasAnyFinancialData = report ? Object.entries(report.data_sources).some(([key, count]) => key !== "ai_insights" && count > 0) : false;

  return (
    <DashboardShell
      activeLabel="Reports"
      title="Reports"
      subtitle={report ? report.range.label : "Financial analytics"}
      name={name}
      onSignOut={onSignOut}
      contentMaxWidth="max-w-[1180px]"
      action={
        <ReportControls
          period={period}
          customRange={customRange}
          report={report}
          disabled={isLoading}
          onPeriodChange={setPeriod}
          onCustomRangeChange={setCustomRange}
        />
      }
    >
      {isLoading ? <EmptyPanel>Loading reports...</EmptyPanel> : null}
      {error ? <div className="rounded-[14px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
      {!isLoading && !error && !report ? <EmptyPanel>No report data available yet.</EmptyPanel> : null}
      {report && !hasAnyFinancialData ? <EmptyPanel>No financial records found for {report.range.label}. Add income, expenses, bills, subscriptions, budgets, or savings goals to populate this dashboard.</EmptyPanel> : null}

      {report ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total income" value={formatCurrency(report.total_income)} note={`${report.data_sources.income} income record${report.data_sources.income === 1 ? "" : "s"}`} tone="income" />
            <StatCard label="Total expenses" value={formatCurrency(report.total_expenses)} note="Manual expenses, paid bills, and subscriptions" />
            <StatCard label="Net savings" value={formatSignedCurrency(report.net_savings, "short")} note={`${report.savings_rate}% savings rate`} tone={report.net_savings < 0 ? "warning" : "savings"} />
            <StatCard label="Budget utilization" value={`${report.budget_utilization}%`} note={`${formatSignedCurrency(report.remaining_budget, "over")} remaining`} tone={report.remaining_budget < 0 ? "warning" : "default"} />
          </section>

          <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Bills paid" value={formatCurrency(report.total_bills_paid)} note={`${report.data_sources.bills} bill${report.data_sources.bills === 1 ? "" : "s"} in range`} />
            <StatCard label="Outstanding bills" value={formatCurrency(report.outstanding_bills)} tone={report.outstanding_bills > 0 ? "warning" : "default"} />
            <StatCard label="Subscriptions" value={formatCurrency(report.subscription_spending)} note={`${report.data_sources.subscriptions} tracked subscription${report.data_sources.subscriptions === 1 ? "" : "s"}`} />
            <StatCard label="Average daily spend" value={formatCurrency(report.average_daily_spending)} note={`${formatCurrency(report.average_weekly_spending)} weekly average`} />
          </section>

          <section className="mt-5">
            <LineChart title={`Daily spending trend - ${report.range.label}`} values={report.charts.daily_spending} labelFormatter={formatDateShort} dateRange={report.range} />
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Expense distribution</h2>
              <div className="mt-6 grid place-items-center">
                <Donut categories={categories} />
              </div>
              <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-slate-600">Highest: <span className="font-mono font-semibold text-slate-950">{report.highest_spending_category ? `${report.highest_spending_category.name} ${formatCurrency(report.highest_spending_category.amount)}` : "None"}</span></p>
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-slate-600">Lowest: <span className="font-mono font-semibold text-slate-950">{report.lowest_spending_category ? `${report.lowest_spending_category.name} ${formatCurrency(report.lowest_spending_category.amount)}` : "None"}</span></p>
              </div>
            </article>
            <CategoryBreakdown categories={categories} />
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            <ComparisonBars title="Budget vs actual spending" rows={report.charts.budget_vs_actual} />
            <article className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Budget integration</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <StatCard label="Budget" value={formatCurrency(report.budget.total_budget)} />
                <StatCard label="Spent" value={formatCurrency(report.budget.spent)} />
                <StatCard label="Remaining" value={formatSignedCurrency(report.budget.remaining, "over")} tone={report.budget.remaining < 0 ? "warning" : "savings"} />
                <StatCard label="Monthly savings budget" value={formatCurrency(report.budget.monthly_savings_budget)} note={`${report.budget.savings_allocation_usage}% allocated to goals`} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{report.budget.over_budget_categories.length} over budget categor{report.budget.over_budget_categories.length === 1 ? "y" : "ies"}</p>
                <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-brand-dark">{report.budget.under_budget_categories.length} under budget categor{report.budget.under_budget_categories.length === 1 ? "y" : "ies"}</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">Goal savings: <span className="font-mono font-semibold text-slate-950">{formatCurrency(report.budget.goal_allocation_total)}</span></p>
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">General savings: <span className="font-mono font-semibold text-slate-950">{formatCurrency(report.budget.general_savings)}</span></p>
              </div>
            </article>
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            <LineChart title="Monthly spending trend" values={report.charts.monthly_spending.map((item) => ({ date: `${item.month}-01`, amount: item.amount }))} labelFormatter={formatMonthYear} />
            <article className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Income vs expenses</h2>
              <div className="mt-5 space-y-4">
                {report.charts.income_vs_expense.length === 0 ? <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No income or expense records in this range.</p> : null}
                {report.charts.income_vs_expense.map((item) => {
                  const max = Math.max(1, item.income, item.expenses);

                  return (
                    <div key={item.month}>
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{formatMonthYear(`${item.month}-01`)}</span>
                        <span className={`font-mono ${item.income - item.expenses < 0 ? "text-[#c57a12]" : "text-slate-500"}`}>{formatSignedCurrency(item.income - item.expenses, "short")}</span>
                      </div>
                      <div className="grid gap-1">
                        <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-[#3f7d16]" style={{ width: `${(item.income / max) * 100}%` }} /></div>
                        <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-[#e8775d]" style={{ width: `${(item.expenses / max) * 100}%` }} /></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Savings goals</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <StatCard label="Total goal savings" value={formatCurrency(report.savings.total_goal_savings)} />
                <StatCard label="Goal progress" value={`${report.savings.goal_progress}%`} />
                <StatCard label="Active goals" value={String(report.savings.active_goals)} />
                <StatCard label="Completed goals" value={String(report.savings.completed_goals)} />
              </div>
              <div className="mt-5 space-y-3">
                {report.savings.distribution.length === 0 ? <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No savings goals have been created yet.</p> : null}
                {report.savings.distribution.slice(0, 5).map((goal) => {
                  const percent = goal.target ? Math.min(100, Math.round((goal.amount / goal.target) * 100)) : 0;

                  return (
                    <div key={goal.name}>
                      <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                        <span className="truncate font-semibold text-slate-700">{goal.name}</span>
                        <span className="font-mono text-slate-500">{percent}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-brand-primary" style={{ width: `${percent}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </article>
            <article className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Savings contributions</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <StatCard label="Monthly savings budget" value={formatCurrency(report.savings.monthly_savings_budget)} />
                <StatCard label="General savings" value={formatCurrency(report.savings.general_savings)} />
                <StatCard label="Goal monthly targets" value={formatCurrency(report.savings.monthly_contributions)} />
                <StatCard label="Recorded goal savings" value={formatCurrency(report.savings_contributions)} />
              </div>
              {report.savings.savings_allocation_history.length === 0 && report.savings.goal_contribution_history.length === 0 ? (
                <p className="mt-5 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">Savings allocation history and goal contribution history will appear once those records are available.</p>
              ) : null}
              <div className="mt-5 space-y-3">
                {report.savings.projected_completion.slice(0, 4).map((goal) => (
                  <div key={goal.id} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3 text-xs">
                    <span className="truncate font-semibold text-slate-800">{goal.title}</span>
                    <span className="font-mono text-slate-500">{goal.progress_percent}% by {formatMonthYear(goal.projected_date)}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            <Timeline title="Bills timeline" rows={report.charts.bills_timeline} empty="No bills due in this date range." />
            <Timeline title="Subscriptions timeline" rows={report.charts.subscriptions_timeline} empty="No subscription renewals in this date range." />
          </section>
        </>
      ) : null}
    </DashboardShell>
  );
}
