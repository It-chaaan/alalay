import type { CSSProperties, ReactNode } from "react";

export function SkeletonBlock({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" style={style} className={`skeleton-block block rounded-lg ${className}`} />;
}

export function SkeletonText({ className = "" }: { className?: string }) {
  return <SkeletonBlock className={`h-3 ${className}`} />;
}

export function SkeletonTitle({ className = "" }: { className?: string }) {
  return <SkeletonBlock className={`h-6 w-40 ${className}`} />;
}

export function SkeletonCircle({ className = "" }: { className?: string }) {
  return <SkeletonBlock className={`rounded-full ${className}`} />;
}

export function SkeletonButton({ className = "" }: { className?: string }) {
  return <SkeletonBlock className={`h-10 w-28 rounded-xl ${className}`} />;
}

export function SkeletonProgressBar({ className = "" }: { className?: string }) {
  return <SkeletonBlock className={`h-2 w-full rounded-full ${className}`} />;
}

export function SkeletonChart({ className = "" }: { className?: string }) {
  return <div className={`flex h-48 items-end gap-3 px-2 ${className}`} aria-hidden="true">{[38, 64, 48, 82, 57, 72, 44].map((height, index) => <SkeletonBlock key={index} className="flex-1 rounded-b-sm" style={{ height: `${height}%` }} />)}</div>;
}

export function SkeletonCard({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function SlowLoadNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="mt-3 text-xs font-medium text-slate-500" role="status">Waking up the server, this may take a moment…</p>;
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Loading account summary">
    {Array.from({ length: count }, (_, index) => <SkeletonCard key={index} className="h-[142px]"><div className="flex justify-between"><SkeletonText className="w-24" /><SkeletonCircle className="h-8 w-8" /></div><SkeletonBlock className="mt-5 h-7 w-32" /><SkeletonText className="mt-2 w-24" /></SkeletonCard>)}
  </section>;
}

export function ListSkeleton({ rows = 5, className = "" }: { rows?: number; className?: string }) {
  return <SkeletonCard className={className}><div className="space-y-4">{Array.from({ length: rows }, (_, index) => <SkeletonListItem key={index} />)}</div></SkeletonCard>;
}

export function SkeletonListItem() {
  return <div className="flex items-center gap-3"><SkeletonCircle className="h-10 w-10" /><div className="min-w-0 flex-1"><SkeletonText className="w-2/3" /><SkeletonText className="mt-2 w-1/3" /></div><SkeletonBlock className="h-5 w-20" /></div>;
}

export function SkeletonTableRow() {
  return <div className="flex items-center gap-4 rounded-xl px-2 py-3"><SkeletonCircle className="h-9 w-9" /><SkeletonText className="h-4 flex-1" /><SkeletonText className="w-20" /><SkeletonBlock className="h-8 w-16" /></div>;
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return <SkeletonCard className="overflow-hidden p-0"><div className="border-b border-slate-100 px-5 py-4"><SkeletonText className="w-32" /></div><div className="space-y-1 p-4">{Array.from({ length: rows }, (_, index) => <SkeletonTableRow key={index} />)}</div></SkeletonCard>;
}

export function DashboardSkeleton() {
  return <div className="space-y-5"><div className="grid gap-4 xl:grid-cols-[1.1fr_1.35fr]"><OverviewSkeleton /><SkeletonCard className="h-48"><SkeletonTitle /><div className="mt-7 grid grid-cols-3 gap-4">{Array.from({ length: 6 }, (_, index) => <div key={index} className="text-center"><SkeletonCircle className="mx-auto h-10 w-10" /><SkeletonText className="mx-auto mt-2 w-12" /></div>)}</div></SkeletonCard></div><div className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr]"><SkeletonCard className="h-72"><SkeletonText className="w-24" /><SkeletonChart className="mt-4" /></SkeletonCard><SkeletonCard className="h-72"><SkeletonText className="w-24" /><SkeletonCircle className="mx-auto mt-6 h-24 w-24" /><SkeletonProgressBar className="mt-5" /></SkeletonCard></div><section className="grid items-start gap-4 xl:grid-cols-[1.25fr_0.9fr]"><SkeletonCard className="h-[330px]"><SkeletonTitle /><div className="mt-5 grid grid-cols-7 gap-3">{Array.from({ length: 28 }, (_, index) => <SkeletonCircle key={index} className="mx-auto h-5 w-5" />)}</div></SkeletonCard><div className="space-y-4"><ListSkeleton rows={3} /><ListSkeleton rows={2} /></div></section></div>;
}

export function PageSkeleton({ kind = "list" }: { kind?: "list" | "table" | "report" | "budget" }) {
  if (kind === "report" || kind === "budget") return <div className="space-y-4"><StatCardsSkeleton count={3} /><SkeletonCard className="h-72"><SkeletonText className="w-40" /><SkeletonBlock className="mt-6 h-44 w-full" /></SkeletonCard><ListSkeleton rows={4} /></div>;
  return kind === "table" ? <TableSkeleton /> : <ListSkeleton />;
}

export function SettingsSkeleton() {
  return <SkeletonCard><div className="flex items-center gap-4"><SkeletonCircle className="h-16 w-16" /><div className="flex-1"><SkeletonTitle className="h-4 w-32" /><SkeletonText className="mt-2 w-48" /><SkeletonButton className="mt-3 h-8 w-24" /></div></div><div className="mt-5 grid gap-4 md:grid-cols-2"><SkeletonBlock className="h-10" /><SkeletonBlock className="h-10" /><SkeletonBlock className="h-10" /><SkeletonBlock className="h-10" /></div><SkeletonButton className="mt-5" /></SkeletonCard>;
}

function OverviewSkeleton() { return <SkeletonCard className="h-48 bg-brand-soft/30"><SkeletonText className="w-28" /><SkeletonTitle className="mt-5 h-9 w-52" /><SkeletonText className="mt-3 w-36" /><SkeletonProgressBar className="mt-6 w-3/4" /></SkeletonCard>; }
function ControlsSkeleton() { return <div className="flex justify-end gap-2"><SkeletonButton className="w-40" /><SkeletonButton className="w-28" /></div>; }

export function WalletsSkeleton() { return <div className="space-y-6"><OverviewSkeleton /><div className="flex items-center justify-between"><SkeletonTitle /><ControlsSkeleton /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><ListSkeleton rows={1} /><ListSkeleton rows={1} /><ListSkeleton rows={1} /></div><div className="grid gap-4 xl:grid-cols-[1fr_320px]"><ListSkeleton rows={3} /><ListSkeleton rows={3} /></div></div>; }
export function IncomeSkeleton() { return <div className="space-y-5"><OverviewSkeleton /><ControlsSkeleton /><div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]"><ListSkeleton rows={4} /><SkeletonCard><SkeletonTitle /><SkeletonChart className="mt-5" /></SkeletonCard></div><TableSkeleton rows={4} /></div>; }
export function ExpensesSkeleton() { return <div className="space-y-5"><OverviewSkeleton /><ControlsSkeleton /><div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]"><ListSkeleton rows={5} /><TableSkeleton rows={5} /></div></div>; }
export function BillsSkeleton() { return <div className="space-y-5"><OverviewSkeleton /><ControlsSkeleton /><TableSkeleton rows={6} /></div>; }
export function LoansSkeleton() { return <div className="space-y-5"><StatCardsSkeleton /><SkeletonCard><SkeletonTitle /><div className="mt-5 space-y-5">{Array.from({ length: 4 }, (_, index) => <div key={index}><SkeletonListItem /><SkeletonProgressBar className="mt-3" /></div>)}</div></SkeletonCard></div>; }
export function BudgetSkeleton() { return <div className="space-y-5"><OverviewSkeleton /><ControlsSkeleton /><SkeletonCard><SkeletonTitle /><div className="mt-5 space-y-5">{Array.from({ length: 5 }, (_, index) => <div key={index}><SkeletonListItem /><SkeletonProgressBar className="mt-3" /></div>)}</div></SkeletonCard></div>; }
export function GoalsSkeleton() { return <div className="space-y-5"><OverviewSkeleton /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <SkeletonCard key={index}><SkeletonTitle /><SkeletonText className="mt-3 w-2/3" /><SkeletonProgressBar className="mt-7" /></SkeletonCard>)}</div></div>; }
export function ReportsSkeleton() { return <div className="space-y-5"><StatCardsSkeleton count={3} /><div className="grid gap-4 xl:grid-cols-2"><SkeletonCard><SkeletonTitle /><SkeletonChart className="mt-5" /></SkeletonCard><SkeletonCard><SkeletonTitle /><SkeletonChart className="mt-5" /></SkeletonCard></div><TableSkeleton rows={4} /></div>; }
