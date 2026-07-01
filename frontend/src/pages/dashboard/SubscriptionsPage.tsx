import type { Session } from "@supabase/supabase-js";
import { SubscriptionFormPanel } from "../../components/forms/FinancialActionPanels";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useActionDialog } from "../../hooks/useActionDialog";
import { useSubscriptions } from "../../hooks/useSubscriptions";
import { formatCurrency, formatDateShort } from "../../utils/formatters";

export function SubscriptionsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Juan";
  const addSubscriptionDialog = useActionDialog("add-subscription");
  const { data: subscriptions, isLoading, error, refetch } = useSubscriptions();
  const cards = subscriptions ?? [];

  return (
    <DashboardShell
      activeLabel="Subscriptions"
      title="Subscriptions"
      name={name}
      onSignOut={onSignOut}
      action={
        <button
          type="button"
          onClick={addSubscriptionDialog.open}
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          <span className="text-lg leading-none">+</span> Add subscription
        </button>
      }
    >
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">AI Subscription Audit</div>
      {isLoading ? <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading subscriptions...</div> : null}
      {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
      {!isLoading && !error && cards.length === 0 ? <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">No subscriptions yet. Add one to track renewals.</div> : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <article key={card.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-primary font-bold text-white">{card.name[0]}</div>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">{card.billing_cycle}</span>
            </div>
            <h3 className="mt-4 font-medium">{card.name}</h3>
            <div className="mt-1 text-xl font-bold">{formatCurrency(Number(card.amount))}<span className="text-sm font-normal text-slate-500">/{card.billing_cycle === "yearly" ? "yr" : "mo"}</span></div>
            <p className="mt-1 text-sm text-slate-500">Renews {formatDateShort(card.renewal_date)}</p>
            <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
              <span>Auto-renew</span><span className={`h-6 w-11 rounded-full ${card.auto_renew ? "bg-brand-primary" : "bg-slate-300"}`}></span>
            </div>
          </article>
        ))}
      </div>
      <SubscriptionFormPanel
        open={addSubscriptionDialog.isOpen}
        onClose={addSubscriptionDialog.close}
        onSuccess={refetch}
      />
    </DashboardShell>
  );
}
