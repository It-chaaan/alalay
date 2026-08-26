import { Search, ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { useApiQuery } from "../../hooks/useApiQuery";
import { NotificationBell } from "../notifications/NotificationBell";

type SearchData = {
  wallets: Array<{ name: string }>;
  bills: Array<{ title: string }>;
  subscriptions: Array<{ name: string }>;
};

type SearchMatch = { label: string; group: string; href: string };

export function DesktopPageHeader({
  title,
  subtitle,
  searchData,
  backHref,
  backLabel = "Go back",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  searchData?: SearchData;
  backHref?: string;
  backLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const { data: wallets } = useApiQuery<Array<{ name: string }>>(searchData ? "" : "/wallets");
  const { data: bills } = useApiQuery<Array<{ title: string }>>(searchData ? "" : "/bills");
  const { data: subscriptions } = useApiQuery<Array<{ name: string }>>(
    searchData ? "" : "/subscriptions",
  );
  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo<SearchMatch[]>(() => {
    if (!normalizedQuery) return [];

    const data = searchData ?? {
      wallets: wallets ?? [],
      bills: bills ?? [],
      subscriptions: subscriptions ?? [],
    };

    return [
      ...data.wallets
        .filter((wallet) => wallet.name.toLowerCase().includes(normalizedQuery))
        .map((wallet) => ({ label: wallet.name, group: "Wallets", href: "/app/wallets" })),
      ...data.bills
        .filter((bill) => bill.title.toLowerCase().includes(normalizedQuery))
        .map((bill) => ({ label: bill.title, group: "Bills", href: "/app/bills" })),
      ...data.subscriptions
        .filter((subscription) => subscription.name.toLowerCase().includes(normalizedQuery))
        .map((subscription) => ({
          label: subscription.name,
          group: "Subscriptions",
          href: "/app/subscriptions",
        })),
    ].slice(0, 6);
  }, [bills, normalizedQuery, searchData, subscriptions, wallets]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setQuery("");
    }

    if (event.key === "Enter" && matches[0]) {
      window.location.assign(matches[0].href);
    }
  }

  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {backHref ? (
          <a
            href={backHref}
            aria-label={backLabel}
            className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </a>
        ) : null}
        <div className="min-w-0">
          <h1 className="page-header-title text-2xl font-bold tracking-normal text-slate-950">{title}</h1>
          {subtitle ? <div className="page-header-subtitle mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
        </div>
      </div>

      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <div className="relative hidden sm:block">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search wallets, bills, subscriptions..."
            aria-label="Search wallets, bills, and subscriptions"
            className="h-10 w-56 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          {normalizedQuery ? (
            <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {matches.length ? matches.map((match, index) => (
                <a key={`${match.group}-${match.label}-${index}`} href={match.href} className="block rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <span className="block text-xs text-slate-400">{match.group}</span>
                  <span className="block truncate text-sm font-medium">{match.label}</span>
                </a>
              )) : <p className="px-3 py-3 text-sm text-slate-500">No Alalay matches.</p>}
            </div>
          ) : null}
        </div>
        <NotificationBell />
      </div>
    </header>
  );
}
