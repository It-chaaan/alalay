import type { Session } from '@supabase/supabase-js';
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Receipt,
  Search,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import alalayLogo from '../../assets/alalay.svg';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { useBills } from '../../hooks/useBills';
import { useDashboard } from '../../hooks/useDashboard';
import { useSubscriptions } from '../../hooks/useSubscriptions';
import { useApiQuery } from '../../hooks/useApiQuery';
import type { Bill, DashboardSummary, Subscription, Wallet } from '../../hooks/types';
import { apiRequest } from '../../lib/apiClient';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import {
  getBillDisplayStatus,
  type BillDisplayStatus,
} from '../../components/dashboard/BillsComponents';
import { formatCurrency, formatDateShort } from '../../utils/formatters';
import {
  DashboardSkeleton,
  ListSkeleton,
  SkeletonBlock,
  SkeletonCard,
  SkeletonText,
  SlowLoadNotice,
} from '../../components/ui/Skeleton';

type DashboardPageProps = {
  session: Session;
  onSignOut: () => void;
};

function getDisplayName(session: Session) {
  const metadataName = session.user.user_metadata?.name || session.user.user_metadata?.full_name;
  const emailName = session.user.email?.split('@')[0];
  return metadataName || emailName || 'Juan';
}

function getPhilippineGreeting(now = new Date()) {
  const hourPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  })
    .formatToParts(now)
    .find((part) => part.type === 'hour')?.value;
  const hour = Number(hourPart);

  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function SmallIcon({ type }: { type: string }) {
  const common = 'h-4 w-4';

  if (type === 'receipt') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={common}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6M9 12h6" />
      </svg>
    );
  }

  if (type === 'clock') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={common}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </svg>
    );
  }

  if (type === 'wallet') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={common}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 7h16v11H4z" />
        <path d="M16 11h4v4h-4z" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={common}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3 14 9l6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
    </svg>
  );
}

type IncomeOccurrence = {
  id: string;
  amount: number | string;
  date: string;
  is_scheduled?: boolean;
};

function CompactBars({
  values,
  tone,
  isPrivate,
  label,
}: {
  values: number[];
  tone: 'income' | 'expense';
  isPrivate: boolean;
  label: string;
}) {
  const maximum = Math.max(1, ...values);

  if (isPrivate) {
    return (
      <div
        className="mt-5 h-12 rounded-xl bg-slate-100 dark:bg-slate-800"
        aria-label={`${label} hidden in privacy mode`}
      />
    );
  }

  return (
    <div className="mt-5 flex h-12 items-end gap-1.5" aria-label={label}>
      {values.map((value, index) => (
        <span
          key={index}
          className={`min-w-0 flex-1 rounded-t-md ${tone === 'income' ? 'bg-brand-primary/75' : 'bg-rose-400/75'}`}
          style={{ height: `${Math.max(10, (value / maximum) * 100)}%` }}
          title={formatCurrency(value)}
        />
      ))}
    </div>
  );
}

function SummaryCards({
  summary,
  wallets,
  incomeRows,
  isPrivate,
  onTogglePrivacy,
}: {
  summary: DashboardSummary;
  wallets: Wallet[];
  incomeRows: IncomeOccurrence[];
  isPrivate: boolean;
  onTogglePrivacy: () => void;
}) {
  const liquidBalance = wallets
    .filter((wallet) => wallet.account_type !== 'credit')
    .reduce((total, wallet) => total + Number(wallet.balance), 0);
  const weekAmounts = (rows: Array<{ date: string; amount: number | string }>) => {
    const buckets = [0, 0, 0, 0];
    rows.forEach((row) => {
      const day = Number(row.date.slice(8, 10));
      buckets[Math.min(3, Math.floor(Math.max(0, day - 1) / 7))] += Number(row.amount);
    });
    return buckets;
  };
  const incomeWeeks = weekAmounts(incomeRows.filter((row) => !row.is_scheduled));
  const spendingMonths = summary.monthly_spending.map((item) => item.value);
  const cards = [
    {
      label: 'My balance',
      value: liquidBalance,
      note: `${wallets.length} liquid wallet${wallets.length === 1 ? '' : 's'} · credit excluded`,
      icon: <WalletCards className="h-4 w-4" />,
      content: (
        <p className="mt-5 text-xs text-slate-500">
          Balance history is shown when account snapshots are available.
        </p>
      ),
    },
    {
      label: 'My income',
      value: summary.monthly_income,
      note: 'This month · actual income',
      icon: <TrendingUp className="h-4 w-4" />,
      content: (
        <CompactBars
          values={incomeWeeks}
          tone="income"
          isPrivate={isPrivate}
          label="Weekly income"
        />
      ),
    },
    {
      label: 'My expense',
      value: summary.monthly_expenses,
      note: 'This month · fees and interest included',
      icon: <TrendingDown className="h-4 w-4" />,
      content: (
        <CompactBars
          values={spendingMonths}
          tone="expense"
          isPrivate={isPrivate}
          label="Monthly spending history"
        />
      ),
    },
  ];

  return (
    <section className="relative grid gap-4 xl:grid-cols-3" aria-label="Account summary">
      {cards.map((item) => (
        <article
          key={item.label}
          className="min-h-44 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {item.label}
            </p>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-brand-primary">
              {item.icon}
            </span>
          </div>
          <p className="mt-5 font-mono text-3xl font-bold text-slate-950 dark:text-white">
            {isPrivate ? '••••••' : formatCurrency(item.value, true)}
          </p>
          <p className="mt-1 text-sm text-slate-500">{item.note}</p>
          {item.content}
        </article>
      ))}
      <button
        type="button"
        onClick={onTogglePrivacy}
        aria-label={isPrivate ? 'Show financial values' : 'Hide financial values'}
        className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100"
      >
        <>{isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</>
      </button>
    </section>
  );
}

function AiInsightCard({ insight }: { insight: DashboardSummary['ai_insight'] }) {
  const statusLabel =
    insight.status === 'configured'
      ? 'Personalized insight'
      : insight.status === 'error'
        ? 'AI temporarily unavailable'
        : 'AI not configured';

  return (
    <article className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
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
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-800 dark:text-slate-200">
            {insight.message}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">
          {insight.status === 'configured'
            ? 'Updated from your latest financial data'
            : 'Open Alalay AI to review your financial data'}
        </span>
        <a
          href="/app/ai-assistant"
          className="font-semibold text-brand-primary hover:text-brand-dark"
        >
          Ask Alalay →
        </a>
      </div>
    </article>
  );
}

type DueDateItem = {
  id: string;
  name: string;
  amount: number;
  date: string;
  kind: 'bill' | 'subscription';
};

function getDueDateItems(bills: Bill[], subscriptions: Subscription[]) {
  return [
    ...bills.map((bill) => ({
      id: `bill-${bill.id}`,
      name: bill.title,
      amount: Number(bill.amount),
      date: bill.due_date,
      kind: 'bill' as const,
    })),
    ...subscriptions.map((subscription) => ({
      id: `subscription-${subscription.id}`,
      name: subscription.name,
      amount: Number(subscription.amount),
      date: subscription.renewal_date,
      kind: 'subscription' as const,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function DueDatesCalendar({
  bills,
  subscriptions,
}: {
  bills: Bill[];
  subscriptions: Subscription[];
}) {
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const items = useMemo<DueDateItem[]>(
    () => [
      ...bills.map((bill) => ({
        id: `bill-${bill.id}`,
        name: bill.title,
        amount: Number(bill.amount),
        date: bill.due_date,
        kind: 'bill' as const,
      })),
      ...subscriptions.map((subscription) => ({
        id: `subscription-${subscription.id}`,
        name: subscription.name,
        amount: Number(subscription.amount),
        date: subscription.renewal_date,
        kind: 'subscription' as const,
      })),
    ],
    [bills, subscriptions],
  );
  const itemsByDate = useMemo(() => {
    const grouped = new Map<string, DueDateItem[]>();
    items.forEach((item) => grouped.set(item.date, [...(grouped.get(item.date) ?? []), item]));
    return grouped;
  }, [items]);
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();
  const cells = Array.from(
    { length: Math.ceil((startOffset + daysInMonth) / 7) * 7 },
    (_, index) => {
      const day = index - startOffset + 1;
      return day > 0 && day <= daysInMonth
        ? new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day)
        : null;
    },
  );
  const selectedItems = selectedDate ? (itemsByDate.get(selectedDate) ?? []) : [];
  const todayKey = toDateKey(new Date());

  function moveMonth(offset: number) {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + offset, 1));
    setSelectedDate(null);
  }

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">Due Dates</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label="Previous month"
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-28 text-center text-xs font-semibold text-slate-700">
            {monthTitle(visibleMonth)}
          </span>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            aria-label="Next month"
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} className="min-h-10 rounded-lg" />;
          const dateKey = toDateKey(date);
          const dayItems = itemsByDate.get(dateKey) ?? [];
          const selected = selectedDate === dateKey;
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => dayItems.length && setSelectedDate(selected ? null : dateKey)}
              className={`min-h-10 rounded-lg px-0.5 py-0.5 text-left transition ${dayItems.length ? 'hover:bg-brand-soft' : 'cursor-default'} ${selected ? 'bg-brand-soft ring-1 ring-brand-primary' : ''}`}
              aria-label={`${date.toDateString()}${dayItems.length ? `, ${dayItems.length} due` : ''}`}
            >
              <span
                className={`mx-auto grid h-5 w-5 place-items-center rounded-full text-[11px] ${dateKey === todayKey ? 'bg-brand-primary font-bold text-white ring-2 ring-brand-primary/20' : 'text-slate-700'}`}
              >
                {date.getDate()}
              </span>
              {dayItems.length ? (
                <span className="mt-0.5 flex justify-center gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {dayItems.some((item) => item.kind === 'subscription') ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  ) : null}
                </span>
              ) : (
                <span className="mt-1 block h-1.5" />
              )}
              <span
                title={dayItems[0]?.name}
                className="mt-0.5 block truncate text-center text-[8px] leading-3 text-slate-500"
              >
                {dayItems[0]?.name ?? ''}
              </span>
              {dayItems.length > 1 ? (
                <span className="block truncate text-center text-[8px] font-semibold leading-3 text-brand-primary">
                  +{dayItems.length - 1} more
                </span>
              ) : (
                <span className="block h-3" />
              )}
            </button>
          );
        })}
      </div>
      {selectedItems.length ? (
        <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-2">
          <p className="text-xs font-semibold text-slate-700">
            Due {formatDateShort(selectedDate ?? '')}
          </p>
          {selectedItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-slate-700">
                {item.name}{' '}
                <span className="text-slate-400">
                  · {item.kind === 'bill' ? 'Bill' : 'Subscription'}
                </span>
              </span>
              <span className="shrink-0 font-mono font-semibold text-slate-950">
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex gap-3 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Bill
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
          Subscription
        </span>
      </div>
    </article>
  );
}

function UpcomingWidget({
  bills,
  subscriptions,
  onViewCalendar,
}: {
  bills: Bill[];
  subscriptions: Subscription[];
  onViewCalendar: () => void;
}) {
  const today = toDateKey(new Date());
  const items = getDueDateItems(bills, subscriptions);
  const upcoming = items.filter((item) => item.date >= today).slice(0, 5);
  const visibleItems = upcoming.length ? upcoming : items.slice(0, 5);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">Upcoming</h2>
        <button
          type="button"
          onClick={onViewCalendar}
          className="text-xs font-semibold text-brand-primary hover:text-brand-dark"
        >
          View full calendar
        </button>
      </div>
      <div className="mt-3 space-y-1">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <div key={item.id} className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${item.kind === 'bill' ? 'bg-amber-400' : 'bg-violet-500'}`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                {item.name}
              </span>
              <span className="shrink-0 text-xs text-slate-500">{formatDateShort(item.date)}</span>
              <span className="shrink-0 font-mono text-xs font-semibold text-slate-950">
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))
        ) : (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Nothing upcoming.</p>
        )}
      </div>
      <div className="mt-3 flex gap-3 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Bill
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
          Subscription
        </span>
      </div>
    </article>
  );
}

function CalendarModal({
  bills,
  subscriptions,
  onClose,
}: {
  bills: Bill[];
  subscriptions: Subscription[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Full due dates calendar"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Full calendar</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Close full calendar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <DueDatesCalendar bills={bills} subscriptions={subscriptions} />
        </div>
      </div>
    </div>
  );
}

function formatBillListDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(year, month - 1, day),
  );
}

function daysUntil(date: string, todayIso: string) {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = todayIso.split('-').map(Number);
  return Math.round(
    (new Date(year, month - 1, day).getTime() -
      new Date(todayYear, todayMonth - 1, todayDay).getTime()) /
      86400000,
  );
}

function getBillStatusCopy(status: BillDisplayStatus, bill: Bill, todayIso: string) {
  if (status === 'paid') return 'Paid';
  if (status === 'overdue') return 'Overdue';
  if (status === 'due_today') return 'Due today';
  const days = daysUntil(bill.due_date, todayIso);
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
}

function getBillStatusTone(status: BillDisplayStatus) {
  if (status === 'paid') return 'bg-emerald-500';
  if (status === 'overdue') return 'bg-rose-500';
  if (status === 'draft') return 'bg-slate-400';
  return 'bg-amber-400';
}

function RecentUpcomingBills({
  bills,
  onMarkPaid,
}: {
  bills: Bill[];
  onMarkPaid: (bill: Bill) => Promise<void>;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [payingId, setPayingId] = useState<string | null>(null);
  const upcomingBills = useMemo(
    () =>
      bills
        .filter((bill) => bill.status !== 'paid')
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .slice(0, 2),
    [bills],
  );

  async function handlePay(bill: Bill) {
    setPayingId(bill.id);
    try {
      await onMarkPaid(bill);
    } finally {
      setPayingId(null);
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">Upcoming Bills</h2>
        <a
          href="/app/bills"
          className="shrink-0 text-xs font-semibold text-brand-primary hover:text-brand-dark"
        >
          View all <span aria-hidden="true">→</span>
        </a>
      </div>
      <div className="mt-3 space-y-3">
        {upcomingBills.length ? (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Upcoming
            </h3>
            {upcomingBills.map((bill) => {
              const status = getBillDisplayStatus(bill, todayIso);
              return (
                <div key={bill.id}>
                  <div className="flex min-w-0 items-center gap-3">
                    <CategoryIcon category={bill.category} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-950">{bill.title}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatBillListDate(bill.due_date)}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-bold text-slate-950">
                      {formatCurrency(Number(bill.amount))}
                    </p>
                    <span className="hidden shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600 sm:inline-flex">
                      <span
                        className={`h-2 w-2 rounded-full ${getBillStatusTone(status)}`}
                        aria-hidden="true"
                      />
                      {getBillStatusCopy(status, bill, todayIso)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handlePay(bill)}
                      disabled={payingId === bill.id}
                      className="shrink-0 rounded-full bg-brand-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
                    >
                      {payingId === bill.id ? 'Paying…' : 'Pay Now'}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No upcoming unpaid bills.
          </p>
        )}
      </div>
    </article>
  );
}

function RecentTransactions({
  items,
  isPrivate,
}: {
  items: DashboardSummary['recent_activity'];
  isPrivate: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950 dark:text-white">Recent Transactions</h2>
        <a href="/app/expenses" className="text-xs font-semibold text-brand-primary">
          View all →
        </a>
      </div>
      <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {items.length ? (
          items.slice(0, 6).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 py-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/30"
                aria-hidden="true"
              >
                <Receipt className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {item.merchant}
                </p>
                <p className="text-xs text-slate-500">
                  {item.category} · {formatDateShort(item.date)}
                </p>
              </div>
              <p className="shrink-0 font-mono text-sm font-semibold text-rose-600">
                {isPrivate ? '••••••' : `−${formatCurrency(Number(item.amount))}`}
              </p>
            </div>
          ))
        ) : (
          <p className="py-5 text-sm text-slate-500">No transactions yet.</p>
        )}
      </div>
    </article>
  );
}

function DashboardUtilities({
  wallets,
  bills,
  subscriptions,
}: {
  wallets: Wallet[];
  bills: Bill[];
  subscriptions: Subscription[];
}) {
  const [query, setQuery] = useState('');
  const { data: unread } = useApiQuery<{ count: number }>('/notifications/unread-count');
  const normalizedQuery = query.trim().toLowerCase();
  const matches = normalizedQuery
    ? [
        ...wallets
          .filter((wallet) => wallet.name.toLowerCase().includes(normalizedQuery))
          .map((wallet) => ({ label: wallet.name, group: 'Wallets', href: '/app/wallets' })),
        ...bills
          .filter((bill) => bill.title.toLowerCase().includes(normalizedQuery))
          .map((bill) => ({ label: bill.title, group: 'Bills', href: '/app/bills' })),
        ...subscriptions
          .filter((subscription) => subscription.name.toLowerCase().includes(normalizedQuery))
          .map((subscription) => ({
            label: subscription.name,
            group: 'Subscriptions',
            href: '/app/subscriptions',
          })),
      ].slice(0, 6)
    : [];

  return (
    <div className="flex items-center gap-2">
      <div className="relative hidden sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('');
          }}
          placeholder="Search wallets, bills…"
          aria-label="Search wallets, bills, and subscriptions"
          className="h-10 w-56 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        {normalizedQuery ? (
          <div className="absolute right-0 top-12 z-30 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {matches.length ? (
              matches.map((match, index) => (
                <a
                  key={`${match.group}-${match.label}-${index}`}
                  href={match.href}
                  className="block rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span className="block text-xs text-slate-400">{match.group}</span>
                  <span className="block truncate text-sm font-medium">{match.label}</span>
                </a>
              ))
            ) : (
              <p className="px-3 py-3 text-sm text-slate-500">No dashboard matches.</p>
            )}
          </div>
        ) : null}
      </div>
      <a
        href="/app/settings"
        aria-label={
          unread?.count
            ? 'Open settings notifications: unread notifications'
            : 'Open notification settings'
        }
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <Bell className="h-4 w-4" />
        {unread?.count ? (
          <span
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500"
            aria-hidden="true"
          />
        ) : null}
      </a>
    </div>
  );
}

export function DashboardPage({ session, onSignOut }: DashboardPageProps) {
  const name = getDisplayName(session);
  const greeting = getPhilippineGreeting();
  const { data: summary, isLoading, isSlowLoading, error } = useDashboard();
  const { data: wallets } = useApiQuery<Wallet[]>('/wallets');
  const { data: bills, isLoading: billsLoading, refetch: refetchBills } = useBills();
  const { data: subscriptions, isLoading: subscriptionsLoading } = useSubscriptions();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const { data: incomeRows } = useApiQuery<IncomeOccurrence[]>(
    `/income/occurrences?from=${monthStart}&to=${today}`,
  );
  const [isPrivate, setIsPrivate] = useState(false);
  const scheduleLoading = billsLoading || subscriptionsLoading;
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  async function markBillPaid(bill: Bill) {
    await apiRequest(`/bills/${bill.id}/pay`, { method: 'PATCH' });
    refetchBills();
  }

  return (
    <DashboardShell
      activeLabel="Dashboard"
      title={`${greeting}, ${name.trim().split(' ')[0]}!`}
      subtitle={formattedDate}
      name={name}
      onSignOut={onSignOut}
      action={
        <DashboardUtilities
          wallets={wallets ?? []}
          bills={bills ?? []}
          subscriptions={subscriptions ?? []}
        />
      }
    >
      {isLoading ? (
        <>
          <DashboardSkeleton />
          <SlowLoadNotice show={isSlowLoading} />
        </>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {!isLoading && !error && !summary ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
          No dashboard data available yet.
        </div>
      ) : null}
      {summary ? (
        <>
          <SummaryCards
            summary={summary}
            wallets={wallets ?? []}
            incomeRows={incomeRows ?? []}
            isPrivate={isPrivate}
            onTogglePrivacy={() => setIsPrivate((current) => !current)}
          />

          <section className="mt-5 grid items-start gap-4 xl:grid-cols-[2fr_1fr]">
            {scheduleLoading ? (
              <SkeletonCard className="h-[390px]">
                <SkeletonText className="w-28" />
                <SkeletonBlock className="mt-5 h-72 w-full" />
              </SkeletonCard>
            ) : (
              <DueDatesCalendar bills={bills ?? []} subscriptions={subscriptions ?? []} />
            )}
            <AiInsightCard insight={summary.ai_insight} />
          </section>

          <section className="mt-5 grid items-start gap-4 xl:grid-cols-2">
            {scheduleLoading ? (
              <ListSkeleton rows={2} />
            ) : (
              <RecentUpcomingBills bills={bills ?? []} onMarkPaid={markBillPaid} />
            )}
            <RecentTransactions items={summary.recent_activity} isPrivate={isPrivate} />
          </section>
        </>
      ) : null}
    </DashboardShell>
  );
}
