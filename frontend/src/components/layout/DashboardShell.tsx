import type { ReactNode } from "react";
import { QuickActions } from "../dashboard/QuickActions";
import { DashboardSidebar } from "../navigation/DashboardSidebar";

export function DashboardShell({
  activeLabel,
  title,
  subtitle,
  action,
  children,
  secondaryAction,
  footerNote,
  onSignOut,
  name,
  hideHeader = false,
}: {
  activeLabel: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  secondaryAction?: ReactNode;
  footerNote?: ReactNode;
  onSignOut: () => void;
  name: string;
  hideHeader?: boolean;
}) {
  return (
      <main className="min-h-screen bg-app-background text-slate-950 dark:text-white lg:flex lg:h-screen lg:overflow-hidden">
      <DashboardSidebar activeLabel={activeLabel} name={name} onSignOut={onSignOut} footerNote={footerNote} />
      <section className="mx-auto min-w-0 flex-1 px-5 py-8 sm:px-8 lg:overflow-y-auto lg:px-12">
        <div className="mx-auto w-full max-w-[1480px]">
        {!hideHeader ? (
          <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="page-header-title text-2xl font-bold tracking-normal text-slate-950">{title}</h1>
              {subtitle ? <div className="page-header-subtitle mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
            </div>
            <div className="flex items-center gap-3">{secondaryAction}{action}</div>
          </header>
        ) : null}
        {children}
        </div>
      </section>
      <QuickActions />
    </main>
  );
}
