import { Plus } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  BillsEmptyState,
  QuickActionsMenu,
  SearchField,
  StatusBadge,
  getBillDisplayStatus,
} from "../../components/dashboard/BillsComponents";
import { BillFormPanel } from "../../components/forms/FinancialActionPanels";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useActionDialog } from "../../hooks/useActionDialog";
import { useApiMutation } from "../../hooks/useApiMutation";
import { useBills } from "../../hooks/useBills";
import type { Bill } from "../../hooks/types";
import { formatCurrency, formatDateShort } from "../../utils/formatters";

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
  const overdue = unpaid.filter((bill) => bill.status === "overdue" || bill.due_date < today);

  const counts = useMemo(
    () => ({
      all: rows.length,
      upcoming: rows.filter((bill) => bill.status === "unpaid" && bill.due_date >= today).length,
      overdue: rows.filter((bill) => bill.status === "overdue" || bill.due_date < today).length,
      paid: rows.filter((bill) => bill.status === "paid").length,
    }),
    [rows, today],
  );

  const filteredRows = useMemo(() => {
    let nextRows = rows;

    if (activeFilter === "upcoming") {
      nextRows = rows.filter((bill) => bill.status === "unpaid" && bill.due_date >= today);
    } else if (activeFilter === "overdue") {
      nextRows = rows.filter((bill) => bill.status === "overdue" || bill.due_date < today);
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

      <div className="mt-4 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? <div className="p-5 text-sm text-slate-500">Loading bills...</div> : null}
        {error ? <div className="p-5 text-sm text-red-700">{error}</div> : null}
        {!isLoading && !error && rows.length === 0 ? (
          <BillsEmptyState onAddBill={addBillDialog.open} hasFilters={false} />
        ) : null}
        {!isLoading && !error && rows.length > 0 && filteredRows.length === 0 ? (
          <BillsEmptyState onAddBill={addBillDialog.open} hasFilters />
        ) : null}

        {!isLoading && !error && filteredRows.length > 0 ? (
          <div className="overflow-visible">
            <table className="w-full table-fixed text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-[20%] px-4 py-3 font-medium">Biller</th>
                  <th className="w-[12%] px-4 py-3 font-medium">Category</th>
                  <th className="w-[12%] px-4 py-3 font-medium">Amount</th>
                  <th className="w-[12%] px-4 py-3 font-medium">Due date</th>
                  <th className="w-[12%] px-4 py-3 font-medium">Frequency</th>
                  <th className="w-[12%] px-4 py-3 font-medium">Status</th>
                  <th className="w-[14%] px-4 py-3 font-medium">Action</th>
                  <th className="w-[6%] px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const displayStatus = getBillDisplayStatus(row, today);
                  const isPaid = displayStatus === "paid";

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50 last:border-0"
                    >
                      <td className="truncate px-4 py-4 font-medium">{row.title}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex max-w-full truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          {row.category}
                        </span>
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
                      <td className="px-4 py-4">
                        {isPaid ? (
                          <button
                            type="button"
                            onClick={() => void markBillUnpaid(row.id)}
                            className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                          >
                            Reopen
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void markBillPaid(row.id)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                          >
                            Mark paid
                          </button>
                        )}
                      </td>
                      <td className="relative px-4 py-4 text-right">
                        <QuickActionsMenu
                          bill={row}
                          isOpen={openMenuId === row.id}
                          onToggle={() =>
                            setOpenMenuId((current) => (current === row.id ? null : row.id))
                          }
                          onEdit={() => openEditBill(row)}
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
