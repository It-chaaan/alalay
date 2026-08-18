import { CheckCircle2, Plus, Trash2, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  BillsEmptyState,
  QuickActionsMenu,
  SearchField,
  StatusBadge,
  getBillDisplayStatus,
  isOverdueBill,
  isUpcomingBill,
} from '../../components/dashboard/BillsComponents';
import { BillFormPanel } from '../../components/forms/FinancialActionPanels';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { LinkLogo } from '../../components/ui/LinkLogo';
import { CategoryBadge } from '../../components/ui/CategoryBadge';
import { useActionDialog } from '../../hooks/useActionDialog';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useBills } from '../../hooks/useBills';
import type { Bill, Wallet } from '../../hooks/types';
import { formatCurrency, formatDateShort } from '../../utils/formatters';
import { normalizeExternalUrl, openExternalLink } from '../../utils/linkPreview';
import { PageSkeleton, SlowLoadNotice } from '../../components/ui/Skeleton';

type BillFilter = 'all' | 'upcoming' | 'overdue' | 'paid';

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function BillsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Juan';
  const addBillDialog = useActionDialog('add-bill');
  const { data: bills, isLoading, isSlowLoading, error, refetch } = useBills();
  const {
    mutate,
    isSubmitting: isPaymentSubmitting,
    error: paymentError,
    reset: resetPaymentMutation,
  } = useApiMutation();
  const {
    mutate: mutateDelete,
    isSubmitting: isDeleteSubmitting,
    error: deleteError,
    reset: resetDeleteMutation,
  } = useApiMutation();
  const { data: wallets } = useApiQuery<Wallet[]>('/wallets');
  const [activeFilter, setActiveFilter] = useState<BillFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [paymentBill, setPaymentBill] = useState<Bill | null>(null);
  const [paymentWalletId, setPaymentWalletId] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayInputValue());
  const [deleteBillTarget, setDeleteBillTarget] = useState<Bill | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const rows = bills ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const unpaid = rows.filter((bill) => bill.status !== 'paid');
  const dueThisWeek = unpaid.filter((bill) => bill.due_date >= today && bill.due_date <= weekEnd);
  const overdue = unpaid.filter((bill) => isOverdueBill(bill, today));

  const counts = useMemo(
    () => ({
      all: rows.length,
      upcoming: rows.filter((bill) => isUpcomingBill(bill, today)).length,
      overdue: rows.filter((bill) => isOverdueBill(bill, today)).length,
      paid: rows.filter((bill) => bill.status === 'paid').length,
    }),
    [rows, today],
  );

  const filteredRows = useMemo(() => {
    let nextRows = rows;

    if (activeFilter === 'upcoming') {
      nextRows = rows.filter((bill) => isUpcomingBill(bill, today));
    } else if (activeFilter === 'overdue') {
      nextRows = rows.filter((bill) => isOverdueBill(bill, today));
    } else if (activeFilter === 'paid') {
      nextRows = rows.filter((bill) => bill.status === 'paid');
    }

    if (!deferredSearchQuery) {
      return nextRows;
    }

    return nextRows.filter((bill) =>
      [bill.title, bill.category, bill.frequency ?? '', bill.status]
        .join(' ')
        .toLowerCase()
        .includes(deferredSearchQuery),
    );
  }, [activeFilter, deferredSearchQuery, rows, today]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenuId(null);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest('[data-bill-menu]')) {
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

  async function markBillPaid() {
    if (!paymentBill || !paymentWalletId || isPaymentSubmitting) return;
    try {
      await mutate(`/bills/${paymentBill.id}/pay`, {
        method: 'PATCH',
        body: JSON.stringify({
          wallet_id: paymentWalletId,
          payment_date: paymentDate,
          occurrence_date: paymentBill.due_date,
        }),
      });
      setPaymentBill(null);
      setOpenMenuId(null);
      refetch();
    } catch {
      // The mutation hook exposes the safe API message while the dialog remains open.
    }
  }

  function closePaymentDialog() {
    if (isPaymentSubmitting) return;
    setPaymentBill(null);
    resetPaymentMutation();
  }

  async function markBillUnpaid(id: string) {
    await mutate(`/bills/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'unpaid',
        paid_at: null,
        paid_occurrence_date: null,
        due_date: rows.find((bill) => bill.id === id)?.due_date,
      }),
    });
    setOpenMenuId(null);
    refetch();
  }

  async function deleteBill(id: string) {
    try {
      await mutateDelete(`/bills/${id}`, { method: 'DELETE' });
      setDeleteBillTarget(null);
      setOpenMenuId(null);
      await refetch();
    } catch {
      // Keep the confirmation open and show the safe mutation error below.
    }
  }

  function openEditBill(bill: Bill) {
    setEditingBill(bill);
    setIsEditOpen(true);
    setOpenMenuId(null);
  }

  return (
    <DashboardShell
      activeLabel="Bills"
      title="Bills"
      name={name}
      onSignOut={onSignOut}
      action={
        <button
          type="button"
          onClick={addBillDialog.open}
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          <Plus className="h-4 w-4" />
          Add bill
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          label="Total unpaid"
          value={formatCurrency(unpaid.reduce((sum, bill) => sum + Number(bill.amount), 0))}
        />
        <Stat
          label="Due this week"
          value={formatCurrency(dueThisWeek.reduce((sum, bill) => sum + Number(bill.amount), 0))}
          accent="text-amber-600"
        />
        <Stat
          label="Overdue"
          value={formatCurrency(overdue.reduce((sum, bill) => sum + Number(bill.amount), 0))}
          accent="text-red-500"
        />
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-full bg-slate-100 p-1 text-sm">
          {[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { key: 'overdue', label: 'Overdue', count: counts.overdue },
            { key: 'paid', label: 'Paid', count: counts.paid },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveFilter(item.key as BillFilter)}
              className={`rounded-full px-4 py-1.5 transition ${
                activeFilter === item.key
                  ? 'bg-white shadow-sm text-slate-950'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>

        <SearchField
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search bills..."
          aria-label="Search bills"
          className="sm:w-62"
        />
      </div>

      <div className="mt-4 overflow-visible rounded-[14px] border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <>
            <PageSkeleton kind="table" />
            <SlowLoadNotice show={isSlowLoading} />
          </>
        ) : null}
        {error ? <div className="p-6 text-sm text-red-700">{error}</div> : null}
        {!isLoading && !error && rows.length === 0 ? (
          <BillsEmptyState onAddBill={addBillDialog.open} hasFilters={false} />
        ) : null}
        {!isLoading && !error && rows.length > 0 && filteredRows.length === 0 ? (
          <BillsEmptyState onAddBill={addBillDialog.open} hasFilters />
        ) : null}

        {!isLoading && !error && filteredRows.length > 0 ? (
          <div className="overflow-visible">
            <table className="w-full table-fixed text-sm">
              <thead className="text-left text-[13px] text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-[25%] px-4 py-4 font-medium">Biller</th>
                  <th className="w-[15%] px-4 py-4 font-medium">Category</th>
                  <th className="w-[14%] px-4 py-4 font-medium">Amount</th>
                  <th className="w-[13%] px-4 py-4 font-medium">Due date</th>
                  <th className="w-[14%] px-4 py-4 font-medium">Frequency</th>
                  <th className="w-[14%] px-4 py-4 font-medium">Status</th>
                  <th className="w-[5%] px-3 py-4 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const displayStatus = getBillDisplayStatus(row, today);
                  const billLink = normalizeExternalUrl(row.attachment_url);

                  return (
                    <tr
                      key={row.id}
                      className="h-16 border-b border-slate-100 transition hover:bg-slate-50 last:border-0"
                    >
                      <td className="px-4 py-4 font-medium">
                        <div className="flex min-w-0 items-center gap-3">
                          <LinkLogo
                            label={row.title}
                            link={row.attachment_url}
                            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-slate-50 p-1"
                            textClassName="text-[11px] font-semibold text-slate-500"
                          />
                          <span className="truncate">{row.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <CategoryBadge category={row.category} compact />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-semibold">
                        {formatCurrency(Number(row.amount))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                        {formatDateShort(row.due_date)}
                      </td>
                      <td className="truncate px-4 py-4 text-slate-600">
                        {row.frequency ?? 'One-time'}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={displayStatus} />
                      </td>
                      <td
                        className="relative px-3 py-4 text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <QuickActionsMenu
                          bill={row}
                          isOpen={openMenuId === row.id}
                          todayIso={today}
                          onOpenLink={
                            billLink ? () => openExternalLink(row.attachment_url) : undefined
                          }
                          onToggle={() =>
                            setOpenMenuId((current) => (current === row.id ? null : row.id))
                          }
                          onEdit={() => openEditBill(row)}
                          onMarkPaid={() => {
                            resetPaymentMutation();
                            setPaymentBill(row);
                            setPaymentWalletId(row.wallet_id ?? wallets?.[0]?.id ?? '');
                            setPaymentDate(todayInputValue());
                            setOpenMenuId(null);
                          }}
                          onMarkUnpaid={() => void markBillUnpaid(row.id)}
                          onDelete={() => {
                            setDeleteBillTarget(row);
                            setOpenMenuId(null);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <BillFormPanel
        open={addBillDialog.isOpen}
        onClose={addBillDialog.close}
        onSuccess={refetch}
      />
      {paymentBill ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Mark bill as paid"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Mark as paid</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {paymentBill.title} · {formatCurrency(Number(paymentBill.amount))}
                </p>
              </div>
              <button
                type="button"
                onClick={closePaymentDialog}
                disabled={isPaymentSubmitting}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mt-5 block text-sm font-semibold">
              Payment method
              <select
                value={paymentWalletId}
                onChange={(event) => setPaymentWalletId(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Select wallet</option>
                {(wallets ?? []).map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name} · {wallet.account_type ?? wallet.institution_type}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Payment date
              <input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            {paymentError ? (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {paymentError}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closePaymentDialog}
                disabled={isPaymentSubmitting}
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!paymentWalletId || isPaymentSubmitting}
                onClick={() => void markBillPaid()}
                className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isPaymentSubmitting ? 'Recording…' : 'Confirm payment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteBillTarget ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Delete bill confirmation"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="text-lg font-semibold">Delete bill?</h2>
            <p className="mt-2 text-sm text-slate-500">
              {deleteBillTarget.title} will be removed from your bill schedule.
            </p>
            {deleteError ? <p className="mt-3 text-sm text-red-600">{deleteError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  resetDeleteMutation();
                  setDeleteBillTarget(null);
                }}
                disabled={isDeleteSubmitting}
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteBill(deleteBillTarget.id)}
                disabled={isDeleteSubmitting}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleteSubmitting ? 'Deleting…' : 'Delete bill'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <BillFormPanel
        open={isEditOpen}
        bill={editingBill}
        onClose={() => {
          setIsEditOpen(false);
          setEditingBill(null);
        }}
        onSuccess={refetch}
      />
    </DashboardShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${accent || ''}`}>{value}</div>
    </div>
  );
}

function getCategoryBadgeClasses(category: string) {
  const normalizedCategory = category.toLowerCase();

  if (normalizedCategory.includes('utilit')) {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (normalizedCategory.includes('government')) {
    return 'bg-blue-50 text-blue-700';
  }

  return 'bg-slate-100 text-slate-500';
}
