import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { IncomeFormPanel } from "../../components/forms/FinancialActionPanels";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useActionDialog } from "../../hooks/useActionDialog";
import { useIncome } from "../../hooks/useIncome";
import type { IncomeEntry } from "../../hooks/types";
import { formatCurrency, formatDateShort } from "../../utils/formatters";
import { buildIncomeMonthlySeries } from "../../utils/incomeSeries";

type IncomeSourceType = "salary" | "freelance" | "business" | "remittance" | "other";

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", options).format(date);
}


function TrendIcon({ tone }: { tone: IncomeSourceType }) {
  const toneClass = {
    salary: "bg-[#e8f1df] text-[#3f7d16]",
    freelance: "bg-[#eaf3fb] text-[#5e9bc9]",
    business: "bg-[#fff5e7] text-[#e9ad58]",
    passive: "bg-slate-100 text-slate-300",
  };

  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${toneClass[tone]}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m6 15 4-4 3 3 5-6" />
        <path d="M15 8h3v3" />
      </svg>
    </span>
  );
}

function SourcePill({ type }: { type: IncomeSourceType }) {
  const classes = {
    salary: "bg-[#e8f1df] text-[#3f7d16]",
    freelance: "bg-[#eaf3fb] text-[#5e9bc9]",
    business: "bg-[#fff5e7] text-[#df9f42]",
    remittance: "bg-[#e8f1df] text-[#3f7d16]",
    other: "bg-slate-100 text-slate-500",
  };

  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${classes[type]}`}>{type[0].toUpperCase() + type.slice(1)}</span>;
}

function IncomeChart({ entries, today }: { entries: IncomeEntry[]; today: Date }) {
  const chartHeight = 160;
  const monthly = buildIncomeMonthlySeries(entries, today);
  const max = Math.max(60000, ...monthly.map((item) => item.total));
  const yAxisLabels = [60000, 45000, 30000, 15000, 0];

  function formatAxisLabel(value: number) {
    return value === 0 ? `${formatCurrency(0)}k` : `${formatCurrency(value / 1000)}k`;
  }

  return (
    <article className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-slate-950">Income by source - {today.getFullYear()}</h2>
        <div className="flex items-center gap-5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#3f7d16]" />Salary</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#6fa3d2]" />Freelance</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#f4c37d]" />Business</span>
        </div>
      </div>
      <div className="grid grid-cols-[48px_1fr]">
        <div className="flex h-44 flex-col justify-between pb-6 pt-1 text-right text-xs text-slate-500">
          {yAxisLabels.map((value) => <span key={value}>{formatAxisLabel(value)}</span>)}
        </div>
        <div className="relative h-44 border-l-0">
          {[0, 1, 2, 3, 4].map((line) => (
            <div key={line} className="absolute left-0 right-0 border-t border-dashed border-slate-200" style={{ top: `${line * 25}%` }} />
          ))}
          <div className="relative z-10 grid h-full grid-cols-6 items-end gap-9 px-8 pb-6">
            {monthly.map((item) => {
              const height = Math.round((item.total / max) * chartHeight);

              return (
                <div key={item.key} className="flex h-full flex-col items-center justify-end gap-2">
                  <div className="flex h-[150px] w-8 items-end">
                    <div
                      className={`w-full rounded-t-sm border ${item.current ? "border-[#2d6413] bg-[#3f7d16]" : "border-[#f0c27d] bg-[#f5cf91]"}`}
                      style={{ height: `${height}px` }}
                      title={`${item.month}: ${formatCurrency(item.total)}`}
                    />
                  </div>
                  <span className={`text-xs ${item.current ? "font-semibold text-brand-primary" : "text-slate-500"}`}>
                    {item.month}{item.current ? " · Current" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}

function BreakdownDonut({ entries }: { entries: IncomeEntry[] }) {
  const total = entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const breakdown = ["salary", "freelance", "business"].map((type) => {
    const amount = entries.filter((entry) => entry.type === type).reduce((sum, entry) => sum + Number(entry.amount), 0);
    return {
      label: type[0].toUpperCase() + type.slice(1),
      value: total ? Math.round((amount / total) * 100) : 0,
      color: type === "salary" ? "#3f7d16" : type === "freelance" ? "#6fa3d2" : "#f4c37d",
    };
  });
  const hasBreakdownData = breakdown.some((item) => item.value > 0);
  let offset = 0;

  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <p className="mb-3 text-xs text-slate-500">This month breakdown</p>
      <div className="flex items-center justify-between gap-4">
        <svg viewBox="0 0 42 42" className="h-20 w-20 shrink-0 -rotate-90">
          <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#eef0ec" strokeWidth="5" />
          {hasBreakdownData ? breakdown.map((item) => {
            if (item.value <= 0) return null;
            const circle = (
              <circle
                key={item.label}
                cx="21"
                cy="21"
                r="15.9"
                fill="transparent"
                stroke={item.color}
                strokeWidth="5"
                strokeDasharray={`${item.value} ${100 - item.value}`}
                strokeDashoffset={-offset}
              />
            );
            offset += item.value;
            return circle;
          }) : null}
        </svg>
        <div className="flex-1 space-y-1.5 text-xs">
          {!hasBreakdownData ? <p className="mb-2 text-slate-500">No income recorded this month yet.</p> : null}
          {breakdown.map((item) => (
            <div key={item.label} className="grid grid-cols-[1fr_auto] items-center gap-5">
              <span className="inline-flex items-center gap-2 text-slate-600"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>
              <span className="font-mono text-slate-950">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function IncomePage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [today, setToday] = useState(() => new Date());
  const name = getDisplayName(session);
  const addIncomeDialog = useActionDialog("add-income");
  const { data: entries, isLoading, error, refetch } = useIncome();
  const rows = entries ?? [];
  const monthlySeries = buildIncomeMonthlySeries(rows, today);
  const thisMonthTotal = monthlySeries.find((item) => item.current)?.total ?? 0;
  const thisMonthKey = monthlySeries.find((item) => item.current)?.key ?? getMonthKey(today);
  const thisMonthRows = rows.filter((entry) => entry.date.startsWith(thisMonthKey));
  const ytd = rows.filter((entry) => entry.date.startsWith(String(today.getFullYear()))).reduce((sum, entry) => sum + Number(entry.amount), 0);
  const bySource = Array.from(rows.reduce((map, entry) => {
    const key = `${entry.source}-${entry.type}`;
    const current = map.get(key) ?? { ...entry, amount: 0 };
    current.amount = Number(current.amount) + Number(entry.amount);
    map.set(key, current);
    return map;
  }, new Map<string, IncomeEntry>()).values());

  useEffect(() => {
    const interval = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const monthLabel = getMonthLabel(today, { month: "long", year: "numeric" });

  return (
    <DashboardShell
      activeLabel="Income"
      title="Income"
      subtitle={`All sources - ${monthLabel}`}
      name={name}
      onSignOut={onSignOut}
      action={
        <button
          type="button"
          onClick={addIncomeDialog.open}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
        >
          <span className="text-xl leading-none">+</span>Add income source
        </button>
      }
    >
      {isLoading ? <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading income...</div> : null}
      {error ? <div className="rounded-[14px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
      {!isLoading && !error && rows.length === 0 ? <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">No income records yet. Add an income source to start tracking earnings.</div> : null}
      {!isLoading && !error && rows.length > 0 ? (
        <>
      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: "This month", value: thisMonthTotal, note: "Current month" },
          { label: "Sources", value: bySource.length, note: "Active income sources", count: true },
          { label: "YTD earnings", value: ytd, note: "This year" },
          { label: "Avg / month", value: ytd / Math.max(1, new Date().getMonth() + 1), note: "Year average" },
        ].map((item) => (
          <article key={item.label} className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="mt-4 font-mono text-xl font-bold text-slate-950">{item.count ? item.value : formatCurrency(item.value)}</p>
            <p className="mt-1 text-xs text-slate-500">{item.note}</p>
          </article>
        ))}
      </section>

      <section className="mt-5">
        <IncomeChart entries={rows} today={today} />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.5fr]">
        <article className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Income sources</h2>
          <div className="mt-4 space-y-3">
            {bySource.map((source) => (
              <div key={source.id} className="flex items-center gap-3 rounded-2xl bg-[#f8f8f5] p-3">
                <TrendIcon tone={source.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">{source.source}</p>
                  <p className="truncate text-xs text-slate-500">{source.type}</p>
                </div>
                <div className="text-right">
                  <p className={`font-mono text-sm font-bold ${source.type === "salary" ? "text-[#3f7d16]" : source.type === "freelance" ? "text-[#5e9bc9]" : source.type === "business" ? "text-[#df9f42]" : "text-slate-400"}`}>{formatCurrency(source.amount)}</p>
                  <p className="text-xs text-slate-500">/mo</p>
                </div>
              </div>
            ))}
          </div>
          <BreakdownDonut entries={thisMonthRows} />
        </article>

        <article className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Recent income</h2>
          <div className="mt-4">
            {rows.slice(0, 5).map((income) => (
              <div key={income.id} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
                <TrendIcon tone={income.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">{income.source}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-500"><SourcePill type={income.type} />{income.is_recurring ? "Recurring" : "One-time"}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-[#3f7d16]">+{formatCurrency(income.amount)}</p>
                  <p className="text-xs text-slate-400">{formatDateShort(income.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
        </>
      ) : null}
      <IncomeFormPanel
        open={addIncomeDialog.isOpen}
        onClose={addIncomeDialog.close}
        onSuccess={refetch}
      />
    </DashboardShell>
  );
}
