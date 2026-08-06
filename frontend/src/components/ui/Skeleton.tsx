import type { ReactNode } from "react";

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton-block block rounded-lg ${className}`} />;
}

export function SkeletonText({ className = "" }: { className?: string }) {
  return <SkeletonBlock className={`h-3 ${className}`} />;
}

export function SkeletonCircle({ className = "" }: { className?: string }) {
  return <SkeletonBlock className={`rounded-full ${className}`} />;
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
  return <SkeletonCard className={className}><div className="space-y-4">{Array.from({ length: rows }, (_, index) => <div key={index} className="flex items-center gap-3"><SkeletonCircle className="h-10 w-10" /><div className="min-w-0 flex-1"><SkeletonText className="w-2/3" /><SkeletonText className="mt-2 w-1/3" /></div><SkeletonBlock className="h-5 w-20" /></div>)}</div></SkeletonCard>;
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return <SkeletonCard className="overflow-hidden p-0"><div className="border-b border-slate-100 px-5 py-4"><SkeletonText className="w-32" /></div><div className="space-y-1 p-4">{Array.from({ length: rows }, (_, index) => <div key={index} className="flex items-center gap-4 rounded-xl px-2 py-3"><SkeletonCircle className="h-9 w-9" /><SkeletonText className="h-4 flex-1" /><SkeletonText className="w-20" /><SkeletonBlock className="h-8 w-16" /></div>)}</div></SkeletonCard>;
}

export function DashboardSkeleton() {
  return <div className="space-y-5"><StatCardsSkeleton /><section className="grid items-start gap-4 xl:grid-cols-[2fr_1fr]"><SkeletonCard className="h-[390px]"><SkeletonText className="w-28" /><div className="mt-5 grid grid-cols-7 gap-3">{Array.from({ length: 35 }, (_, index) => <SkeletonCircle key={index} className="mx-auto h-7 w-7" />)}</div></SkeletonCard><SkeletonCard className="h-[390px]"><div className="flex gap-4"><SkeletonCircle className="h-10 w-10" /><div className="flex-1"><SkeletonText className="w-32" /><SkeletonText className="mt-4 w-full" /><SkeletonText className="mt-2 w-4/5" /><SkeletonBlock className="mt-8 h-20 w-full" /></div></div></SkeletonCard></section><ListSkeleton rows={2} /></div>;
}

export function PageSkeleton({ kind = "list" }: { kind?: "list" | "table" | "report" | "budget" }) {
  if (kind === "report" || kind === "budget") return <div className="space-y-4"><StatCardsSkeleton count={3} /><SkeletonCard className="h-72"><SkeletonText className="w-40" /><SkeletonBlock className="mt-6 h-44 w-full" /></SkeletonCard><ListSkeleton rows={4} /></div>;
  return kind === "table" ? <TableSkeleton /> : <ListSkeleton />;
}

export function SettingsSkeleton() {
  return <SkeletonCard><SkeletonText className="w-28" /><div className="mt-5 grid gap-4 md:grid-cols-2"><SkeletonBlock className="h-10" /><SkeletonBlock className="h-10" /><SkeletonBlock className="h-10" /><SkeletonBlock className="h-10" /></div><SkeletonBlock className="mt-5 h-10 w-24" /></SkeletonCard>;
}
