import type { ReactNode } from 'react';
import { QuickActions } from '../dashboard/QuickActions';
import { DashboardSidebar } from '../navigation/DashboardSidebar';
import { DesktopPageHeader } from './DesktopPageHeader';

const defaultSubtitles: Record<string, string> = {
  'AI Assistant': 'Your financial companion',
  Bills: 'Track upcoming, paid, and overdue bills',
  Budget: 'Plan how your monthly income is allocated',
  Expenses: 'Review and manage your spending',
  Goals: 'Build and monitor your savings goals',
  Income: 'Track earnings and income sources',
  Reports: 'Understand your financial activity and progress',
  Settings: 'Manage your account and preferences',
  Subscriptions: 'Manage recurring payments and renewals',
  Wallets: 'Manage all your money in one place',
  'Loans & Debt': 'Track money owed to you and what you owe',
};

export function DashboardShell({
  activeLabel,
  title,
  subtitle,
  action,
  headerBottom,
  stickyHeaderBottom = false,
  searchData,
  backHref,
  backLabel,
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
  headerBottom?: ReactNode;
  stickyHeaderBottom?: boolean;
  searchData?: {
    wallets: Array<{ name: string }>;
    bills: Array<{ title: string }>;
    subscriptions: Array<{ name: string }>;
  };
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
  secondaryAction?: ReactNode;
  footerNote?: ReactNode;
  onSignOut: () => void;
  name: string;
  hideHeader?: boolean;
}) {
  return (
    <main className="min-h-screen bg-app-background text-slate-950 dark:text-white lg:flex lg:h-screen lg:overflow-hidden">
      <DashboardSidebar
        activeLabel={activeLabel}
        name={name}
        onSignOut={onSignOut}
        footerNote={footerNote}
      />
      <section className="mx-auto min-w-0 flex-1 px-5 py-8 sm:px-8 lg:overflow-y-auto lg:px-12">
        <div className="mx-auto w-full max-w-[1480px]">
          {!hideHeader ? (
            <DesktopPageHeader
              title={title}
              subtitle={subtitle ?? defaultSubtitles[activeLabel]}
              searchData={searchData}
              backHref={backHref}
              backLabel={backLabel}
            />
          ) : null}
          {secondaryAction || action ? (
            <div className="mb-7 flex flex-wrap items-center justify-end gap-3">
              {secondaryAction}
              {action}
            </div>
          ) : null}
          {headerBottom ? (
            <div className={stickyHeaderBottom ? 'sticky top-0 z-20 mb-7 py-1' : 'mb-7'}>
              {headerBottom}
            </div>
          ) : null}
          {children}
        </div>
      </section>
      <QuickActions />
    </main>
  );
}
