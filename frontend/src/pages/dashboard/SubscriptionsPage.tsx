import type { Session } from '@supabase/supabase-js';
import { ExternalLink, Pen, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MenuAction, MoreActionsMenu } from '../../components/dashboard/BillsComponents';
import { SubscriptionFormPanel } from '../../components/forms/FinancialActionPanels';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { LinkLogo } from '../../components/ui/LinkLogo';
import { useActionDialog } from '../../hooks/useActionDialog';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useIncomeSummary } from '../../hooks/useIncomeSummary';
import type { Subscription } from '../../hooks/types';
import { useSubscriptions } from '../../hooks/useSubscriptions';
import { formatCurrency, formatDateShort } from '../../utils/formatters';
import { normalizeExternalUrl, openExternalLink } from '../../utils/linkPreview';
import { getNextSubscriptionRenewalDate } from '../../utils/subscriptionRenewal';
import { BillsSkeleton, SlowLoadNotice } from '../../components/ui/Skeleton';

function monthlyAmount(subscription: Subscription) {
  const amount = Number(subscription.amount);
  if (subscription.billing_cycle === 'yearly') return amount / 12;
  if (subscription.billing_cycle === 'quarterly') return amount / 3;
  if (subscription.billing_cycle === 'weekly') return (amount * 52) / 12;
  return amount;
}

function currentCycleLabel(subscription: Subscription) {
  if (subscription.current_status === 'paid') return 'Paid';
  if (subscription.current_status === 'due_today') return 'Due today';
  if (subscription.current_status === 'overdue') return 'Overdue';
  return 'Upcoming';
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
          ? 'justify-end border-brand-primary bg-brand-primary'
          : 'justify-start border-slate-300 bg-slate-200'
      }`}
    >
      <span className="sr-only">
        {checked ? 'Turn renewal reminder off' : 'Turn renewal reminder on'}
      </span>
      <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[9px] font-bold uppercase text-slate-600 shadow-sm">
        {checked ? '' : ''}
      </span>
    </button>
  );
}

export function SubscriptionsPage({
  session,
  onSignOut,
}: {
  session: Session;
  onSignOut: () => void;
}) {
  const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Juan';
  const addSubscriptionDialog = useActionDialog('add-subscription');
  const { data: subscriptions, isLoading, isSlowLoading, error, refetch } = useSubscriptions();
  const { data: incomeSummary } = useIncomeSummary();
  const { mutate, isSubmitting, error: mutationError } = useApiMutation();
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const cards = subscriptions ?? [];
  const monthlyTracked = cards.reduce((sum, subscription) => sum + monthlyAmount(subscription), 0);
  const yearlyTracked = monthlyTracked * 12;
  const monthlyIncome = Number(incomeSummary?.this_month ?? 0);
  const incomePercent = monthlyIncome > 0 ? (monthlyTracked / monthlyIncome) * 100 : null;
  const visibleCards = cards.filter((card) =>
    [card.name, card.category ?? '', card.custom_category ?? '', card.wallet_id ?? '']
      .join(' ')
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase()),
  );
  const nextRenewals = [...cards]
    .sort((a, b) =>
      String(a.next_renewal_date ?? a.renewal_date).localeCompare(
        String(b.next_renewal_date ?? b.renewal_date),
      ),
    )
    .slice(0, 3);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenuId(null);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest('[data-actions-menu]')) {
        setOpenMenuId(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClickOutside);
    };
  }, []);

  async function toggleRenewalReminder(subscription: Subscription) {
    try {
      await mutate<Subscription>(`/subscriptions/${subscription.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ auto_renew: !subscription.auto_renew }),
      });
      refetch();
    } catch {
      // useApiMutation exposes the save error for the page alert.
    }
  }

  async function deleteSubscription(subscription: Subscription) {
    const confirmed = window.confirm(
      `Delete ${subscription.name}? This removes it from local tracking.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await mutate(`/subscriptions/${subscription.id}`, { method: 'DELETE' });
      refetch();
    } catch {
      // useApiMutation exposes the save error for the page alert.
    }
  }

  function openEditSubscription(subscription: Subscription) {
    setEditingSubscription(subscription);
    setIsEditOpen(true);
    setOpenMenuId(null);
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
      title="Subscriptions"
      subtitle="Manage recurring payments and renewals"
      name={name}
      onSignOut={onSignOut}
    >
      {isLoading ? (
        <>
          <BillsSkeleton />
          <SlowLoadNotice show={isSlowLoading} />
        </>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {mutationError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {mutationError}
        </div>
      ) : null}
      {!isLoading && !error ? (
        <>
          <section className="relative overflow-hidden rounded-2xl border border-emerald-700/20 bg-brand-primary p-5 text-white shadow-sm">
            <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border border-white/15" />
            <div className="pointer-events-none absolute -right-2 -bottom-20 h-52 w-52 rounded-full border border-white/10" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                  Subscriptions overview
                </p>
                <span className="text-xs text-white/75">Current month</span>
              </div>
              <p className="mt-3 font-mono text-3xl font-bold">
                {formatCurrency(monthlyTracked)}
                <span className="ml-1 text-sm font-normal text-white/75">/ month</span>
              </p>
              <div className="mt-5 grid gap-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-white/65">Projected yearly</p>
                  <p className="mt-1 font-mono font-semibold">{formatCurrency(yearlyTracked)}</p>
                </div>
                <div>
                  <p className="text-white/65">Of monthly income</p>
                  <p className="mt-1 font-mono font-semibold">
                    {incomePercent === null ? 'Not available' : `${incomePercent.toFixed(1)}%`}
                  </p>
                </div>
                <div>
                  <p className="text-white/65">Active subscriptions</p>
                  <p className="mt-1 font-mono font-semibold">{cards.length}</p>
                </div>
                <div>
                  <p className="text-white/65">Next renewal</p>
                  <p className="mt-1 font-semibold">
                    {nextRenewals[0]
                      ? `${nextRenewals[0].name} · ${formatDateShort(nextRenewals[0].next_renewal_date ?? nextRenewals[0].renewal_date)}`
                      : 'None scheduled'}
                  </p>
                </div>
              </div>
            </div>
          </section>
          {nextRenewals.length ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>
                <strong>Upcoming renewals</strong> · {nextRenewals.length} tracked renewal
                {nextRenewals.length === 1 ? '' : 's'} next in line
              </span>
              <span className="font-mono font-semibold">
                {formatCurrency(nextRenewals.reduce((sum, item) => sum + monthlyAmount(item), 0))}{' '}
                monthly equivalent
              </span>
            </div>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Active subscriptions{' '}
                <span className="text-sm font-normal text-slate-500">({cards.length})</span>
              </h2>
              <p className="mt-1 text-xs text-slate-500">Recurring payments you are tracking</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search subscriptions"
                  aria-label="Search subscriptions"
                  className="h-10 w-56 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </label>
              <button
                type="button"
                onClick={addSubscriptionDialog.open}
                className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                <Plus className="h-4 w-4" />
                Add subscription
              </button>
            </div>
          </div>
        </>
      ) : null}
      {!isLoading && !error && cards.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">No subscriptions yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            Add recurring services to see monthly costs and upcoming renewals in one place.
          </p>
          <button
            type="button"
            onClick={addSubscriptionDialog.open}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Add subscription
          </button>
        </div>
      ) : null}
      {!isLoading && !error && cards.length > 0 && !visibleCards.length ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          No subscriptions match “{searchQuery}”.
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {visibleCards.map((card) => {
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
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                  {card.billing_cycle}
                </span>
              </div>
              <h3 className="mt-4 font-medium">{card.name}</h3>
              <div className="mt-1 text-xl font-bold">
                {formatCurrency(Number(card.amount))}
                <span className="text-sm font-normal text-slate-500">
                  /
                  {card.billing_cycle === 'yearly'
                    ? 'yr'
                    : card.billing_cycle === 'quarterly'
                      ? 'qtr'
                      : card.billing_cycle === 'weekly'
                        ? 'wk'
                        : 'mo'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Current cycle: {currentCycleLabel(card)} ·{' '}
                {formatDateShort(card.current_occurrence_date ?? card.renewal_date)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Next renewal{' '}
                {formatDateShort(
                  card.next_renewal_date ??
                    getNextSubscriptionRenewalDate(card.renewal_date, card.billing_cycle),
                )}
              </p>
              {card.last_used_at ? (
                <p className="mt-1 text-sm text-slate-500">
                  Manual last used {formatDateShort(card.last_used_at)}
                </p>
              ) : null}
              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500">
                <p className="font-medium text-slate-700">Renewal reminder</p>
                <RenewalReminderSwitch
                  checked={card.auto_renew}
                  disabled={isSubmitting}
                  onToggle={() => {
                    void toggleRenewalReminder(card);
                  }}
                />
              </div>
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <MoreActionsMenu
                  isOpen={openMenuId === card.id}
                  onToggle={() =>
                    setOpenMenuId((current) => (current === card.id ? null : card.id))
                  }
                  ariaLabel={`More actions for ${card.name}`}
                  estimatedMenuHeight={subscriptionLink ? 136 : 96}
                >
                  {subscriptionLink ? (
                    <MenuAction
                      icon={ExternalLink}
                      label="Open link"
                      tone="info"
                      onClick={() => {
                        setOpenMenuId(null);
                        openExternalLink(card.logo_url);
                      }}
                    />
                  ) : null}
                  <MenuAction
                    icon={Pen}
                    label="Edit subscription"
                    tone="info"
                    onClick={() => openEditSubscription(card)}
                  />
                  <MenuAction
                    icon={Trash2}
                    label="Delete subscription"
                    tone="danger"
                    disabled={isSubmitting}
                    onClick={() => {
                      setOpenMenuId(null);
                      void deleteSubscription(card);
                    }}
                  />
                </MoreActionsMenu>
              </div>
            </article>
          );
        })}
      </div>

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
