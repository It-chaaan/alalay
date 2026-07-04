import type { Session } from "@supabase/supabase-js";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { SubscriptionFormPanel } from "../../components/forms/FinancialActionPanels";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { LinkLogo } from "../../components/ui/LinkLogo";
import { useActionDialog } from "../../hooks/useActionDialog";
import { useApiMutation } from "../../hooks/useApiMutation";
import { useSettings } from "../../hooks/useSettings";
import type { Subscription } from "../../hooks/types";
import { useSubscriptions } from "../../hooks/useSubscriptions";
import { formatCurrency, formatDateShort } from "../../utils/formatters";
import { normalizeExternalUrl, openExternalLink } from "../../utils/linkPreview";

function monthlyAmount(subscription: Subscription) {
  const amount = Number(subscription.amount);
  return subscription.billing_cycle === "yearly" ? amount / 12 : amount;
}

function RenewalReminderSwitch({
  checked,
  disabled,
  onToggle,
}: {
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={`inline-flex h-7 w-14 shrink-0 items-center rounded-full border px-1 transition focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? "justify-end border-brand-primary bg-brand-primary"
          : "justify-start border-slate-300 bg-slate-200"
      }`}
    >
      <span className="sr-only">
        {checked ? "Turn renewal reminder off" : "Turn renewal reminder on"}
      </span>
      <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[9px] font-bold uppercase text-slate-600 shadow-sm">
        {checked ? "" : ""}
      </span>
    </button>
  );
}

export function SubscriptionsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Juan";
  const addSubscriptionDialog = useActionDialog("add-subscription");
  const { data: subscriptions, isLoading, error, refetch } = useSubscriptions();
  const { data: profile } = useSettings();
  const { mutate, isSubmitting, error: mutationError } = useApiMutation();
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const cards = subscriptions ?? [];
  const monthlyTracked = cards.reduce((sum, subscription) => sum + monthlyAmount(subscription), 0);
  const yearlyTracked = monthlyTracked * 12;
  const monthlyIncome = Number(profile?.income ?? 0);
  const incomePercent = monthlyIncome > 0 ? (monthlyTracked / monthlyIncome) * 100 : null;

  async function toggleRenewalReminder(subscription: Subscription) {
    try {
      await mutate<Subscription>(`/subscriptions/${subscription.id}`, {
        method: "PATCH",
        body: JSON.stringify({ auto_renew: !subscription.auto_renew }),
      });
      refetch();
    } catch {
      // useApiMutation exposes the save error for the page alert.
    }
  }

  async function deleteSubscription(subscription: Subscription) {
    const confirmed = window.confirm(`Delete ${subscription.name}? This removes it from local tracking.`);
    if (!confirmed) {
      return;
    }

    try {
      await mutate(`/subscriptions/${subscription.id}`, { method: "DELETE" });
      refetch();
    } catch {
      // useApiMutation exposes the save error for the page alert.
    }
  }

  function openEditSubscription(subscription: Subscription) {
    setEditingSubscription(subscription);
    setIsEditOpen(true);
  }

  function closeEditSubscription() {
    setIsEditOpen(false);
    setEditingSubscription(null);
  }

  function handleSubscriptionSuccess() {
    refetch();
  }

  return (
    <DashboardShell
      activeLabel="Subscriptions"
      title={
        <span className="inline-flex items-center gap-3">
          Subscriptions
          <span className="rounded-full bg-brand-muted px-3 py-1 text-xs font-semibold text-brand-primary">
            {formatCurrency(monthlyTracked)}/mo
          </span>
        </span>
      }
      name={name}
      onSignOut={onSignOut}
      action={
        <button
          type="button"
          onClick={addSubscriptionDialog.open}
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus aria-hidden="true" className="h-4 w-4" /> Add subscription
        </button>
      }
    >
      {isLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading subscriptions...</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
      {mutationError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{mutationError}</div> : null}
      {!isLoading && !error && cards.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">No subscriptions yet. Add one to track renewals.</div> : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const subscriptionLink = normalizeExternalUrl(card.logo_url);

          return (
          <article
            key={card.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <LinkLogo
                label={card.name}
                link={card.logo_url}
                className="grid h-14 w-14 place-items-center rounded-2xl border border-slate-200 bg-slate-50 p-2"
                textClassName="text-sm font-semibold text-slate-500"
              />
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">{card.billing_cycle}</span>
            </div>
            <h3 className="mt-4 font-medium">{card.name}</h3>
            <div className="mt-1 text-xl font-bold">{formatCurrency(Number(card.amount))}<span className="text-sm font-normal text-slate-500">/{card.billing_cycle === "yearly" ? "yr" : "mo"}</span></div>
            <p className="mt-1 text-sm text-slate-500">Renews {formatDateShort(card.renewal_date)}</p>
            {card.last_used_at ? <p className="mt-1 text-sm text-slate-500">Manual last used {formatDateShort(card.last_used_at)}</p> : null}
            <div className="mt-5 flex items-center justify-between gap-3 text-sm text-slate-500">
              <div>
                <p className="font-medium text-slate-700">Renewal reminder</p>
                <p className="mt-0.5 text-xs text-slate-500">{card.auto_renew ? "On locally" : "Off locally"}</p>
              </div>
              <RenewalReminderSwitch
                checked={card.auto_renew}
                disabled={isSubmitting}
                onToggle={() => {
                  void toggleRenewalReminder(card);
                }}
              />
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              {subscriptionLink ? (
              <button
                type="button"
                onClick={() => openExternalLink(card.logo_url)}
                className="mr-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-primary hover:text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
                aria-label={`Open ${card.name} link`}
                title="Open link"
              >
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                Open link
              </button>
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openEditSubscription(card);
                }}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
                aria-label={`Edit ${card.name}`}
                title="Edit subscription"
              >
                <Pencil aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void deleteSubscription(card);
                }}
                disabled={isSubmitting}
                className="grid h-8 w-8 place-items-center rounded-full text-red-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`Delete ${card.name}`}
                title="Delete subscription"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </article>
          );
        })}
      </div>

      <section className="mt-6 grid gap-4 rounded-[14px] border border-slate-200 bg-white px-5 py-4 shadow-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Monthly total</p>
          <p className="mt-1 font-mono text-xl font-bold text-slate-950">{formatCurrency(monthlyTracked)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Yearly cost</p>
          <p className="mt-1 font-mono text-xl font-bold text-slate-950">{formatCurrency(yearlyTracked)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">% of income</p>
          <p className="mt-1 font-mono text-xl font-bold text-[#c57a12]">
            {incomePercent === null ? "--" : `${incomePercent.toFixed(1)}%`}
          </p>
        </div>
      </section>

      <SubscriptionFormPanel
        open={addSubscriptionDialog.isOpen}
        onClose={addSubscriptionDialog.close}
        onSuccess={handleSubscriptionSuccess}
      />
      <SubscriptionFormPanel
        open={isEditOpen}
        subscription={editingSubscription}
        onClose={closeEditSubscription}
        onSuccess={handleSubscriptionSuccess}
      />
    </DashboardShell>
  );
}
