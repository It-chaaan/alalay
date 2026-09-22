import type { ReactNode } from 'react';

export function SectionToolbar({
  title,
  description,
  count,
  children,
  childrenClassName = '',
}: {
  title: string;
  description?: string;
  count?: ReactNode;
  children?: ReactNode;
  childrenClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-slate-950">
          {title}
          {count !== undefined ? (
            <span className="ml-2 text-sm font-normal text-slate-500">({count})</span>
          ) : null}
        </h2>
        {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      </div>
      {children ? (
        <div className={`flex flex-wrap items-center justify-end gap-3 ${childrenClassName}`}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
