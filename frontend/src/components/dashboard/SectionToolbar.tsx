import type { ReactNode } from 'react';

export function SectionToolbar({ title, description, count, children }: { title: string; description?: string; count?: ReactNode; children?: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-semibold text-slate-950">{title}{count !== undefined ? <span className="ml-2 text-sm font-normal text-slate-500">({count})</span> : null}</h2>{description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}</div>{children ? <div className="flex flex-wrap items-center justify-end gap-3">{children}</div> : null}</div>;
}
