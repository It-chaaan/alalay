import type { ReactNode } from 'react';

export function FinancialOverviewCard({
  label,
  period,
  primary,
  primaryLabel,
  metrics,
  children,
}: {
  label: string;
  period: ReactNode;
  primary: ReactNode;
  primaryLabel?: string;
  metrics: Array<{ label: string; value: ReactNode; tone?: string }>;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-[20px] border border-emerald-700/20 bg-brand-primary p-5 text-white shadow-sm">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full border border-white/15"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 right-20 h-64 w-64 rounded-full border border-white/10"
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="pt-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
            {label}
          </p>
          <span className="ml-auto text-xs text-white/75">{period}</span>
        </div>
        <p className="mt-3 font-mono text-3xl font-bold">{primary}</p>
        {primaryLabel ? <p className="mt-1 text-xs text-white/70">{primaryLabel}</p> : null}
        <div className="my-4 h-px bg-white/20" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <p className="text-xs text-white/65">{metric.label}</p>
              <p className={`mt-1 font-mono text-sm font-semibold ${metric.tone ?? ''}`}>
                {metric.value}
              </p>
            </div>
          ))}
        </div>
        {children}
      </div>
    </section>
  );
}
