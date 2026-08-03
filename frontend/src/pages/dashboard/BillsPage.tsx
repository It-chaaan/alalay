import { Plus } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  BillsEmptyState,
  QuickActionsMenu,
  SearchField,
  StatusBadge,
  getBillDisplayStatus,
  isOverdueBill,
  isUpcomingBill,
} from "../../components/dashboard/BillsComponents";
import { BillFormPanel } from "../../components/forms/FinancialActionPanels";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { LinkLogo } from "../../components/ui/LinkLogo";
import { CategoryBadge } from "../../components/ui/CategoryBadge";
import { useActionDialog } from "../../hooks/useActionDialog";
import { useApiMutation } from "../../hooks/useApiMutation";
import { useBills } from "../../hooks/useBills";
import type { Bill } from "../../hooks/types";
import { formatCurrency, formatDateShort } from "../../utils/formatters";
import { normalizeExternalUrl, openExternalLink } from "../../utils/linkPreview";

type BillFilter = "all" | "upcoming" | "overdue" | "paid";

export function BillsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Juan";
  const addBillDialog = useActionDialog("add-bill");
  const { data: bills, isLoading, error, refetch } = useBills();
  const { mutate } = useApiMutation();
  const [activeFilter, setActiveFilter] = useState<BillFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const rows = bills ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const unpaid = rows.filter((bill) => bill.status !== "paid");
  const dueThisWeek = unpaid.filter((bill) => bill.due_date >= today && bill.due_date <= weekEnd);
  const overdue = unpaid.filter((bill) => isOverdueBill(bill, today));

  const counts = useMemo(
    () => ({
      all: rows.length,
      upcoming: rows.filter((bill) => isUpcomingBill(bill, today)).length,
      overdue: rows.filter((bill) => isOverdueBill(bill, today)).length,
      paid: rows.filter((bill) => bill.status === "paid").length,
    }),
    [rows, today],
  );

  const filteredRows = useMemo(() => {
    let nextRows = rows;

    if (activeFilter === "upcoming") {
      nextRows = rows.filter((bill) => isUpcomingBill(bill, today));
    } else if (activeFilter === "overdue") {
      nextRows = rows.filter((bill) => isOverdueBill(bill, today));
    } else if (activeFilter === "paid") {
      nextRows = rows.filter((bill) => bill.status === "paid");
    }

    if (!deferredSearchQuery) {
      return nextRows;
    }

    return nextRows.filter((bill) =>
      [bill.title, bill.category, bill.frequency ?? "", bill.status]
        .join(" ")
        .toLowerCase()
        .includes(deferredSearchQuery),
    );
  }, [activeFilter, deferredSearchQuery, rows, today]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest("[data-bill-menu]")) {
        setOpenMenuId(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClickOutside);
    };
  }, []);

  async function markBillPaid(id: string) {
    await mutate(`/bills/${id}/pay`, { method: "PATCH" });
    setOpenMenuId(null);
    refetch();
  }

  async function markBillUnpaid(id: string) {
    await mutate(`/bills/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "unpaid", paid_at: null }),
    });
    setOpenMenuId(null);
    refetch();
  }

  async function deleteBill(id: string) {
    await mutate(`/bills/${id}`, { method: "DELETE" });
    setOpenMenuId(null);
    refetch();
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
      contentMaxWidth="max-w-[1100px]"
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
            { key: "all", label: "All", count: counts.all },
            { key: "upcoming", label: "Upcoming", count: counts.upcoming },
            { key: "overdue", label: "Overdue", count: counts.overdue },
            { key: "paid", label: "Paid", count: counts.paid },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveFilter(item.key as BillFilter)}
              className={`rounded-full px-4 py-1.5 transition ${
                activeFilter === item.key ? "bg-white shadow-sm text-slate-950" : "text-slate-500 hover:text-slate-700"
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
        {isLoading ? <div className="p-6 text-sm text-slate-500">Loading bills...</div> : null}
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
                      <td className="truncate px-4 py-4 text-slate-600">{row.frequency ?? "One-time"}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={displayStatus} />
                      </td>
                      <td className="relative px-3 py-4 text-right" onClick={(event) => event.stopPropagation()}>
                        <QuickActionsMenu
                          bill={row}
                          isOpen={openMenuId === row.id}
                          todayIso={today}
                          onOpenLink={billLink ? () => openExternalLink(row.attachment_url) : undefined}
                          onToggle={() =>
                            setOpenMenuId((current) => (current === row.id ? null : row.id))
                          }
                          onEdit={() => openEditBill(row)}
                          onMarkPaid={() => void markBillPaid(row.id)}
                          onMarkUnpaid={() => void markBillUnpaid(row.id)}
                          onDelete={() => {
                            const confirmed = window.confirm(
                              `Delete ${row.title}? This cannot be undone.`,
                            );
                            if (confirmed) {
                              void deleteBill(row.id);
                            }
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
      <div className={`mt-2 text-2xl font-bold ${accent || ""}`}>{value}</div>
    </div>
  );
}

function getCategoryBadgeClasses(category: string) {
  const normalizedCategory = category.toLowerCase();

  if (normalizedCategory.includes("utilit")) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (normalizedCategory.includes("government")) {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-slate-100 text-slate-500";
}
