import type { Session } from "@supabase/supabase-js";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useBills } from "../../hooks/useBills";
import { formatCurrency, formatDateShort } from "../../utils/formatters";

export function BillsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Juan";
  const { data: bills, isLoading, error } = useBills();
  const rows = bills ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const unpaid = rows.filter((bill) => bill.status !== "paid");
  const dueThisWeek = unpaid.filter((bill) => bill.due_date >= today && bill.due_date <= weekEnd);
  const overdue = unpaid.filter((bill) => bill.status === "overdue" || bill.due_date < today);

  return (
    <DashboardShell
      activeLabel="Bills"
      title="Bills"
      name={name}
      onSignOut={onSignOut}
      action={<button className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"><span className="text-lg leading-none">+</span> Add bill</button>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Total unpaid" value={formatCurrency(unpaid.reduce((sum, bill) => sum + Number(bill.amount), 0))} />
        <Stat label="Due this week" value={formatCurrency(dueThisWeek.reduce((sum, bill) => sum + Number(bill.amount), 0))} accent="text-amber-600" />
        <Stat label="Overdue" value={formatCurrency(overdue.reduce((sum, bill) => sum + Number(bill.amount), 0))} accent="text-red-500" />
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm">
          {["All", "Upcoming", "Overdue", "Paid"].map((item, index) => (
            <button key={item} className={`rounded-full px-4 py-1.5 ${index === 0 ? "bg-white shadow-sm" : "text-slate-500"}`}>{item}</button>
          ))}
        </div>
        <input className="w-56 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none" placeholder="Search bills..." />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? <div className="p-5 text-sm text-slate-500">Loading bills...</div> : null}
        {error ? <div className="p-5 text-sm text-red-700">{error}</div> : null}
        {!isLoading && !error && rows.length === 0 ? <div className="p-5 text-sm text-slate-500">No bills yet. Add a bill to start tracking due dates.</div> : null}
        {rows.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-200">
                {["Biller", "Category", "Amount", "Due date", "Frequency", "Status", ""].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-4 font-medium">{row.title}</td>
                  <td className="px-4 py-4"><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{row.category}</span></td>
                  <td className="px-4 py-4 font-semibold">{formatCurrency(Number(row.amount))}</td>
                  <td className="px-4 py-4 text-slate-600">{formatDateShort(row.due_date)}</td>
                  <td className="px-4 py-4 text-slate-600">{row.frequency ?? "One-time"}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs ${row.status === "overdue" ? "bg-red-50 text-red-500" : row.status === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{row.status}</span></td>
                  <td className="px-4 py-4 text-right text-slate-400">...</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className={`mt-2 text-2xl font-bold ${accent || ""}`}>{value}</div></div>;
}
