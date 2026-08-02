import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { MenuAction, MoreActionsMenu } from "../../components/dashboard/BillsComponents";
import { ExpenseFormPanel } from "../../components/forms/FinancialActionPanels";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useActionDialog } from "../../hooks/useActionDialog";
import { useApiMutation } from "../../hooks/useApiMutation";
import { useBills } from "../../hooks/useBills";
import { useExpenses } from "../../hooks/useExpenses";
import type { Bill, Expense } from "../../hooks/types";
import { formatCurrency, formatDateShort } from "../../utils/formatters";
import { getCategoryColor } from "../../utils/categoryColors";
import { Pen, Scan, Trash2 } from "lucide-react";

type ExpenseListItem = Expense & { source: "expense" | "bill" };

export function ExpensesPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Juan";
  const logExpenseDialog = useActionDialog("log-expense");
  const editExpenseDialog = useActionDialog("edit-expense");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { data: expenses, isLoading: expensesLoading, error: expensesError, refetch } = useExpenses();
  const { data: bills, isLoading: billsLoading, error: billsError } = useBills();
  const { mutate, isSubmitting, error: mutationError } = useApiMutation();
  const items: ExpenseListItem[] = [
    ...(expenses ?? []).map((expense) => ({ ...expense, source: "expense" as const })),
    ...(bills ?? [])
      .filter((bill: Bill) => bill.status === "paid")
      .map((bill) => ({
        id: bill.id,
        amount: bill.amount,
        category: bill.category,
        merchant: bill.title,
        date: bill.paid_at?.slice(0, 10) ?? bill.due_date,
        payment_method: "bill",
        receipt_url: null,
        ocr_raw: null,
        is_split: false,
        split_with: [],
        created_at: bill.created_at,
        source: "bill" as const,
      })),
  ];
  const isLoading = expensesLoading || billsLoading;
  const error = expensesError ?? billsError;
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
  const categories = Array.from(new Set(items.map((item) => item.category)));
  const categoryBreakdown = categories.map((category, index) => {
    const amount = items.filter((item) => item.category === category).reduce((sum, item) => sum + Number(item.amount), 0);
    return { category, amount, percent: total ? (amount / total) * 100 : 0, color: getCategoryColor(category, index) };
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest("[data-actions-menu]")) {
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

  function openEditExpense(expense: Expense) {
    setSelectedExpense(expense);
    editExpenseDialog.open();
    setOpenMenuId(null);
  }

  function closeEditExpense() {
    editExpenseDialog.close();
    setSelectedExpense(null);
  }

  async function deleteExpense(expense: Expense) {
    const confirmed = window.confirm(`Delete ${expense.merchant}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      await mutate(`/expenses/${expense.id}`, { method: "DELETE" });
      setOpenMenuId(null);
      refetch();
    } catch {
      // useApiMutation exposes the delete error for the page alert.
    }
  }

  return (
    <DashboardShell
      activeLabel="Expenses"
      title="Expenses"
      name={name}
      onSignOut={onSignOut}
      secondaryAction=
      {<button
          type="button"
          onClick={() => window.location.assign("/app/ocr-scanner")}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium min-w-20"
        >
          <Scan className="h-4 w-4" /> Scan receipt
        </button>}
      action={
        <button
          type="button"
          onClick={() => {
            setSelectedExpense(null);
            logExpenseDialog.open();
          }}
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          <span className="text-lg leading-none">+</span> Log expense
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Total spent" value={formatCurrency(total)} />
        <Stat label="Categories" value={String(categories.length)} accent="text-green-600" />
        <Stat label="Transactions" value={String(items.length)} accent="text-amber-600" />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Spending by category</h2>
        <div className="mt-4 flex h-8 overflow-hidden rounded-full">
          {categoryBreakdown.length ? categoryBreakdown.map((item) => (
            <div key={item.category} style={{ width: `${item.percent}%`, backgroundColor: item.color }} title={`${item.category}: ${formatCurrency(item.amount)}`} />
          )) : <div className="w-full bg-slate-100" />}
        </div>
        {categoryBreakdown.length ? (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600" aria-label="Spending by category legend">
            {categoryBreakdown.map((item) => (
              <span key={item.category} className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <span>{item.category}</span>
                <span className="font-mono text-slate-500">{formatCurrency(item.amount)} ({item.percent.toFixed(1)}%)</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-5">
        {isLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading expenses...</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : null}
        {mutationError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{mutationError}</div> : null}
        {!isLoading && !error && items.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">No expenses yet. Log an expense to start seeing your spending.</div> : null}
        {items.map((item) => (
          <div key={item.id}>
            <div className="mb-2 text-sm text-slate-500">{formatDateShort(item.date)}</div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 p-4 last:border-0">
                <div className="min-w-0">
                  <div className="font-medium">{item.merchant}</div>
                  <div className="mt-1 flex gap-2 text-xs"><span className="rounded-full bg-slate-100 px-2 py-0.5">{item.category}</span><span className="rounded-full bg-slate-100 px-2 py-0.5">{item.payment_method}</span></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-mono font-semibold">{formatCurrency(Number(item.amount))}</div>
                  {item.source === "expense" ? (
                    <MoreActionsMenu
                      isOpen={openMenuId === item.id}
                      onToggle={() => setOpenMenuId((current) => (current === item.id ? null : item.id))}
                      ariaLabel={`More actions for ${item.merchant} expense`}
                      estimatedMenuHeight={96}
                    >
                      <MenuAction
                        icon={Pen}
                        label="Edit expense"
                        tone="info"
                        onClick={() => openEditExpense(item)}
                      />
                      <MenuAction
                        icon={Trash2}
                        label="Delete expense"
                        tone="danger"
                        disabled={isSubmitting}
                        onClick={() => {
                          void deleteExpense(item);
                        }}
                      />
                    </MoreActionsMenu>
                  ) : <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Paid bill</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <ExpenseFormPanel
        open={logExpenseDialog.isOpen}
        onClose={logExpenseDialog.close}
        onSuccess={refetch}
      />
      <ExpenseFormPanel
        open={editExpenseDialog.isOpen}
        onClose={closeEditExpense}
        onSuccess={refetch}
        expense={selectedExpense}
      />
    </DashboardShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className={`mt-2 text-2xl font-bold ${accent || ""}`}>{value}</div></div>;
}
