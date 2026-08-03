import type { Session } from "@supabase/supabase-js";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import alalayLogo from "../../assets/alalay.svg";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useBills } from "../../hooks/useBills";
import { useDashboard } from "../../hooks/useDashboard";
import { useSubscriptions } from "../../hooks/useSubscriptions";
import type { Bill, DashboardSummary, Expense, Subscription } from "../../hooks/types";
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
    { label: "Total bills", value: formatCurrency(summary.total_bills_this_month), note: summary.total_bills_this_month ? "This month" : "No bills this month", icon: "receipt" },
    { label: "Due this week", value: formatCurrency(summary.bills_due_this_week), note: summary.bills_due_this_week ? "Upcoming bills" : "No bills due", icon: "clock" },
    { label: "Monthly expenses", value: formatCurrency(summary.monthly_expenses), note: summary.monthly_expenses ? `${summary.monthly_expenses_delta_percent}% vs last month` : "No expenses this month", icon: "wallet" },
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

function AiInsightCard({ insight }: { insight: DashboardSummary["ai_insight"] }) {
  const statusLabel = insight.status === "configured"
    ? "Personalized insight"
    : insight.status === "error"
      ? "AI temporarily unavailable"
      : "AI not configured";

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
              {statusLabel}
            </span>
          </div>
          <p className="mt-3 max-w-3xl leading-7 text-slate-800">{insight.message}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-brand-muted p-4 text-brand-dark">
          <p className="text-sm font-semibold">AI status</p>
          <p className="mt-1 text-sm opacity-80">
            {insight.status === "configured" ? "Generated from your latest Alalay financial data." : "Open Alalay AI to retry or review your financial data."}
          </p>
        </div>
      </div>
    </article>
  );
}

type DueDateItem = {
  id: string;
  name: string;
  amount: number;
  date: string;
  kind: "bill" | "subscription";
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function DueDatesCalendar({ bills, subscriptions }: { bills: Bill[]; subscriptions: Subscription[] }) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const items = useMemo<DueDateItem[]>(() => [
    ...bills.map((bill) => ({ id: `bill-${bill.id}`, name: bill.title, amount: Number(bill.amount), date: bill.due_date, kind: "bill" as const })),
    ...subscriptions.map((subscription) => ({ id: `subscription-${subscription.id}`, name: subscription.name, amount: Number(subscription.amount), date: subscription.renewal_date, kind: "subscription" as const })),
  ], [bills, subscriptions]);
  const itemsByDate = useMemo(() => {
    const grouped = new Map<string, DueDateItem[]>();
    items.forEach((item) => grouped.set(item.date, [...(grouped.get(item.date) ?? []), item]));
    return grouped;
  }, [items]);
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startOffset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - startOffset + 1;
    return day > 0 && day <= daysInMonth ? new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day) : null;
  });
  const selectedItems = selectedDate ? itemsByDate.get(selectedDate) ?? [] : [];
  const todayKey = toDateKey(new Date());

  function moveMonth(offset: number) {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + offset, 1));
    setSelectedDate(null);
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">Due Dates</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-28 text-center text-xs font-semibold text-slate-700">{monthTitle(visibleMonth)}</span>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Next month" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} className="min-h-14 rounded-lg" />;
          const dateKey = toDateKey(date);
          const dayItems = itemsByDate.get(dateKey) ?? [];
          const selected = selectedDate === dateKey;
          return (
            <button key={dateKey} type="button" onClick={() => dayItems.length && setSelectedDate(selected ? null : dateKey)} className={`min-h-14 rounded-lg px-1 py-1 text-left transition ${dayItems.length ? "hover:bg-brand-soft" : "cursor-default"} ${selected ? "bg-brand-soft ring-1 ring-brand-primary" : ""}`} aria-label={`${date.toDateString()}${dayItems.length ? `, ${dayItems.length} due` : ""}`}>
              <span className={`mx-auto grid h-6 w-6 place-items-center rounded-full text-xs ${dateKey === todayKey ? "bg-brand-primary font-bold text-white ring-2 ring-brand-primary/20" : "text-slate-700"}`}>{date.getDate()}</span>
              {dayItems.length ? <span className="mt-0.5 flex justify-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{dayItems.some((item) => item.kind === "subscription") ? <span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> : null}</span> : <span className="mt-2 block h-1.5" />}
              <span className="mt-0.5 block truncate text-center text-[9px] text-slate-500">{dayItems[0]?.name ?? ""}</span>
              {dayItems.length > 1 ? <span className="block text-center text-[9px] font-semibold text-brand-primary">+{dayItems.length - 1} more</span> : <span className="block h-3" />}
            </button>
          );
        })}
      </div>
      {selectedItems.length ? (
        <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-700">Due {formatDateShort(selectedDate ?? "")}</p>
          {selectedItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-slate-700">{item.name} <span className="text-slate-400">· {item.kind === "bill" ? "Bill" : "Subscription"}</span></span><span className="shrink-0 font-mono font-semibold text-slate-950">{formatCurrency(item.amount)}</span></div>)}
        </div>
      ) : null}
      <div className="mt-3 flex gap-3 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Bill</span><span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" />Subscription</span></div>
    </article>
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
              className={`w-full max-w-8 rounded-t-md ${item.current ? "bg-brand-dark" : "bg-brand-primary/60"}`}
              style={{ height: `${Math.max(20, (item.value / max) * 150)}px` }}
              title={`${item.month}${item.current ? " (Current)" : ""}: ${formatCurrency(item.value)}`}
            />
            <span className={`text-xs ${item.current ? "font-semibold text-brand-dark" : "text-slate-500"}`}>{item.month}{item.current ? " · Current" : ""}</span>
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
        {recentActivity.length ? recentActivity.map((activity) => (
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
        )) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No recent activity yet. Your latest expenses will appear here.</p>}
      </div>
    </article>
  );
}

export function DashboardPage({ session, onSignOut }: DashboardPageProps) {
  const name = getDisplayName(session);
  const { data: summary, isLoading, error } = useDashboard();
  const { data: bills } = useBills();
  const { data: subscriptions } = useSubscriptions();
  const formattedDate = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
}).format(new Date());

  return (
    <DashboardShell
      activeLabel="Dashboard"
      title={`Good morning, ${name.trim().split(" ")[0]}!`}
      subtitle={formattedDate}
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
          <DueDatesCalendar bills={bills ?? []} subscriptions={subscriptions ?? []} />
          <AiInsightCard insight={summary.ai_insight} />
        </section>

        <section className="mt-7 grid gap-5 xl:grid-cols-[1.5fr_0.75fr]">
          <SpendingChart monthlySpending={summary.monthly_spending} />
          <RecentActivity recentActivity={summary.recent_activity} />
        </section>
          </>
        ) : null}

    </DashboardShell>
  );
}
