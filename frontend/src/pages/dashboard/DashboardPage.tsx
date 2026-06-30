import type { Session } from "@supabase/supabase-js";
import alalayLogo from "../../assets/alalay.svg";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useDashboard } from "../../hooks/useDashboard";
import type { DashboardSummary, Expense } from "../../hooks/types";
import { formatCurrency, formatDateShort } from "../../utils/formatters";

type DashboardPageProps = {
  session: Session;
  onSignOut: () => void;
};

function getDisplayName(session: Session) {
  const metadataName = session.user.user_metadata?.name || session.user.user_metadata?.full_name;
  const emailName = session.user.email?.split("@")[0];
  return metadataName || emailName || "Juan";
}

function SmallIcon({ type }: { type: string }) {
  const common = "h-4 w-4";

  if (type === "receipt") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6M9 12h6" />
      </svg>
    );
  }

  if (type === "clock") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </svg>
    );
  }

  if (type === "wallet") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7h16v11H4z" />
        <path d="M16 11h4v4h-4z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 14 9l6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
    </svg>
  );
}

function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const items = [
    { label: "Total bills", value: formatCurrency(summary.total_bills_this_month), note: "This month", icon: "receipt" },
    { label: "Due this week", value: formatCurrency(summary.bills_due_this_week), note: "Upcoming bills", icon: "clock" },
    { label: "Monthly expenses", value: formatCurrency(summary.monthly_expenses), note: `${summary.monthly_expenses_delta_percent}% vs last month`, icon: "wallet" },
    { label: "Savings progress", value: `${summary.savings_progress_percent}%`, note: `${formatCurrency(summary.savings_current)} of ${formatCurrency(summary.savings_target)}`, icon: "spark" },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Account summary">
      {items.map((item) => (
        <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-slate-500">{item.label}</p>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-brand-primary">
              <SmallIcon type={item.icon} />
            </span>
          </div>
          <p className="mt-5 font-mono text-2xl font-bold text-slate-950">{item.value}</p>
          <p className="mt-1 text-sm text-slate-500">{item.note}</p>
        </article>
      ))}
    </section>
  );
}

function HealthCard({ score }: { score: number }) {
  const metrics = [
    { label: "On-time bills", value: Math.min(100, score), color: "bg-brand-primary" },
    { label: "Savings rate", value: Math.min(100, score), color: "bg-sky-500" },
    { label: "Budget use", value: Math.min(100, score), color: "bg-amber-500" },
  ];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-slate-950">Financial Health</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-[120px_1fr]">
        <div className="grid h-28 w-28 place-items-center rounded-full border-[10px] border-brand-primary">
          <div className="text-center">
            <div className="font-mono text-2xl font-bold text-brand-primary">{score}</div>
            <div className="text-xs text-slate-500">/100</div>
          </div>
        </div>
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>{metric.label}</span>
                <span className="font-semibold text-slate-700">{metric.value}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100">
                <div className={`h-1.5 rounded-full ${metric.color}`} style={{ width: `${metric.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function AiInsightCard({ message }: { message: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-primary">
          <img src={alalayLogo} alt="" className="h-7 w-7 object-contain" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-950">Alalay AI</h2>
            <span className="rounded-full bg-brand-muted px-2 py-0.5 text-xs font-medium text-brand-dark">
              Bagong insight
            </span>
          </div>
          <p className="mt-3 max-w-3xl leading-7 text-slate-800">{message}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-brand-muted p-4 text-brand-dark">
          <p className="text-sm font-semibold">AI status</p>
          <p className="mt-1 text-sm opacity-80">Connect the AI Edge Function to enable personalized insights.</p>
        </div>
      </div>
    </article>
  );
}

function WeeklyBills({ bills }: { bills: DashboardSummary["weekly_bills"] }) {
  const toneClass = {
    today: "bg-orange-50 text-orange-700",
    upcoming: "bg-amber-50 text-amber-700",
    overdue: "bg-red-50 text-red-600",
  };

  return (
    <section className="mt-7">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-950">Mga bills ngayong linggo</h2>
        <a href="#" className="text-sm font-medium text-brand-primary hover:text-brand-dark">
          Tingnan lahat →
        </a>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {bills.map((bill) => (
          <article
            key={bill.id}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${
              bill.status === "overdue" ? "border-red-200" : "border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-primary text-sm font-bold text-white">
                {bill.title.charAt(0)}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${toneClass[bill.status === "overdue" ? "overdue" : "upcoming"]}`}>
                {bill.status}
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-950">{bill.title}</p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-950">{formatCurrency(Number(bill.amount))}</p>
            <p className="mt-1 text-xs text-slate-500">Due {formatDateShort(bill.due_date)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SpendingChart({ monthlySpending }: { monthlySpending: DashboardSummary["monthly_spending"] }) {
  const max = Math.max(1, ...monthlySpending.map((item) => item.value));

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-semibold text-slate-950">Monthly spending</h2>
        <p className="text-sm text-slate-500">Last 8 months</p>
      </div>
      <div className="flex h-48 items-end gap-4 border-b border-dashed border-slate-200 px-3">
        {monthlySpending.map((item) => (
          <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
            <div
              className="w-full max-w-8 rounded-t-md bg-brand-primary"
              style={{ height: `${Math.max(20, (item.value / max) * 150)}px` }}
              title={`${item.month}: ${formatCurrency(item.value)}`}
            />
            <span className="text-xs text-slate-500">{item.month}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function RecentActivity({ recentActivity }: { recentActivity: Expense[] }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-slate-950">Recent activity</h2>
      <div className="mt-5 space-y-4">
        {recentActivity.map((activity) => (
          <div key={`${activity.merchant}-${activity.date}`} className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-xs font-bold text-white">
              {activity.merchant.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950">{activity.merchant}</p>
              <p className="text-xs text-slate-500">{formatDateShort(activity.date)}</p>
            </div>
            <p className="font-mono text-sm font-bold text-slate-950">
              {formatCurrency(Number(activity.amount))}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

export function DashboardPage({ session, onSignOut }: DashboardPageProps) {
  const name = getDisplayName(session);
  const { data: summary, isLoading, error } = useDashboard();

  return (
    <DashboardShell
      activeLabel="Dashboard"
      title={`Good morning, ${name}`}
      subtitle="Saturday, June 28, 2025"
      name={name}
      onSignOut={onSignOut}
      action={
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex min-h-11 w-fit items-center rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 lg:hidden"
        >
          Sign out
        </button>
      }
    >
        {isLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading dashboard...</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
        {!isLoading && !error && !summary ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">No dashboard data available yet.</div> : null}
        {summary ? (
          <>
        <SummaryCards summary={summary} />

        <section className="mt-7 grid gap-5 xl:grid-cols-[0.9fr_1.6fr]">
          <HealthCard score={summary.health_score} />
          <AiInsightCard message={summary.ai_insight.message} />
        </section>

        <WeeklyBills bills={summary.weekly_bills} />

        <section className="mt-7 grid gap-5 xl:grid-cols-[1.5fr_0.75fr]">
          <SpendingChart monthlySpending={summary.monthly_spending} />
          <RecentActivity recentActivity={summary.recent_activity} />
        </section>
          </>
        ) : null}

    </DashboardShell>
  );
}
