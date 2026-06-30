import type { Session } from "@supabase/supabase-js";
import alalayLogo from "../../assets/alalay.svg";
import {
  aiInsight,
  dashboardNav,
  dashboardSummary,
  financialHealth,
  monthlySpending,
  recentActivity,
  weeklyBills,
} from "../../constants/dashboard";
import { formatCurrency } from "../../utils/formatters";

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

function DashboardSidebar({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r border-slate-200 bg-app-surface lg:flex lg:flex-col">
      <div className="flex h-20 items-center gap-3 px-6">
        <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-brand-primary">
          <img src={alalayLogo} alt="" className="h-7 w-7 object-contain" />
        </span>
        <span className="font-bold text-slate-950">Alalay</span>
      </div>

      <nav className="flex-1 space-y-1 px-4">
        {dashboardNav.map((item, index) => (
          <a
            key={item}
            href={index === 0 ? "/app" : "#"}
            className={`flex min-h-10 items-center rounded-xl px-4 text-sm font-medium transition ${
              index === 0 ? "bg-brand-muted text-brand-dark" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="mr-3 h-2 w-2 rounded-full bg-current opacity-50" />
            {item}
          </a>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-primary text-sm font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-950">{name}</p>
            <p className="mt-1 w-fit rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Free plan</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-primary"
            aria-label="Sign out"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

function SummaryCards() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Account summary">
      {dashboardSummary.map((item) => (
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

function HealthCard() {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-slate-950">Financial Health</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-[120px_1fr]">
        <div className="grid h-28 w-28 place-items-center rounded-full border-[10px] border-brand-primary">
          <div className="text-center">
            <div className="font-mono text-2xl font-bold text-brand-primary">{financialHealth.score}</div>
            <div className="text-xs text-slate-500">/100</div>
          </div>
        </div>
        <div className="space-y-4">
          {financialHealth.metrics.map((metric) => (
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

function AiInsightCard() {
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
          <p className="mt-3 max-w-3xl leading-7 text-slate-800">{aiInsight.body}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {aiInsight.cards.map((card) => (
          <div
            key={card.title}
            className={`rounded-xl p-4 ${
              card.tone === "warning" ? "bg-orange-50 text-orange-950" : "bg-brand-muted text-brand-dark"
            }`}
          >
            <p className="text-sm font-semibold">{card.title}</p>
            <p className="mt-1 text-sm opacity-80">{card.body}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function WeeklyBills() {
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
        {weeklyBills.map((bill) => (
          <article
            key={bill.name}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${
              bill.tone === "overdue" ? "border-red-200" : "border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-primary text-sm font-bold text-white">
                {bill.initial}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${toneClass[bill.tone as keyof typeof toneClass]}`}>
                {bill.status}
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-950">{bill.name}</p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-950">{formatCurrency(bill.amount)}</p>
            <p className="mt-1 text-xs text-slate-500">{bill.due}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SpendingChart() {
  const max = Math.max(...monthlySpending.map((item) => item.value));

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

function RecentActivity() {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-slate-950">Recent activity</h2>
      <div className="mt-5 space-y-4">
        {recentActivity.map((activity) => (
          <div key={`${activity.merchant}-${activity.date}`} className="flex items-center gap-3">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white ${activity.color}`}>
              {activity.initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950">{activity.merchant}</p>
              <p className="text-xs text-slate-500">{activity.date}</p>
            </div>
            <p className={`font-mono text-sm font-bold ${activity.amount > 0 ? "text-green-700" : "text-slate-950"}`}>
              {activity.amount > 0 ? "+" : ""}
              {formatCurrency(Math.abs(activity.amount))}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

export function DashboardPage({ session, onSignOut }: DashboardPageProps) {
  const name = getDisplayName(session);

  return (
    <main className="min-h-screen bg-app-background text-slate-950 lg:flex">
      <DashboardSidebar name={name} onSignOut={onSignOut} />
      <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Good morning, {name}</h1>
            <p className="mt-1 text-slate-500">Saturday, June 28, 2025</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex min-h-11 w-fit items-center rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 lg:hidden"
          >
            Sign out
          </button>
        </header>

        <SummaryCards />

        <section className="mt-7 grid gap-5 xl:grid-cols-[0.9fr_1.6fr]">
          <HealthCard />
          <AiInsightCard />
        </section>

        <WeeklyBills />

        <section className="mt-7 grid gap-5 xl:grid-cols-[1.5fr_0.75fr]">
          <SpendingChart />
          <RecentActivity />
        </section>
      </section>

      <button
        type="button"
        aria-label="Add new item"
        className="fixed bottom-6 right-6 grid h-14 w-14 place-items-center rounded-full bg-brand-primary text-3xl text-white shadow-xl transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
      >
        +
      </button>
    </main>
  );
}
