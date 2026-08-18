import type { HTMLAttributes, ReactNode } from 'react';

export const controlSurfaceClass =
  'min-h-10 rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800';

export const controlButtonClass =
  'inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800';

type DataToolbarProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/** Layout-only companion for search, filter, sort, and view utility controls. */
export function DataToolbar({ children, className = '', ...props }: DataToolbarProps) {
  return (
    <div
      {...props}
      className={`flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap ${className}`}
    >
      {children}
    </div>
  );
}
