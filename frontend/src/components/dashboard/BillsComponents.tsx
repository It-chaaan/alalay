import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  MoreHorizontal,
  Search,
  Pen,
  Trash2,
  Wallet,
  Circle
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ComponentType, InputHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import type { Bill } from "../../hooks/types";
import { formatCurrency, formatDateShort } from "../../utils/formatters";

export type BillDisplayStatus = "paid" | "upcoming" | "due_today" | "overdue" | "draft";

export function getBillDisplayStatus(bill: Bill, todayIso: string): BillDisplayStatus {
  if (bill.status === "paid") {
    return "paid";
  }

  if (bill.status === "overdue" || bill.due_date < todayIso) {
    return "overdue";
  }

  if (bill.due_date === todayIso) {
    return "due_today";
  }

  return "upcoming";
}

function getStatusLabel(status: BillDisplayStatus) {
  if (status === "due_today") {
    return "Due today";
  }

  if (status === "upcoming") {
    return "Upcoming";
  }

  if (status === "overdue") {
    return "Overdue";
  }

  if (status === "paid") {
    return "Paid";
  }

  return "Draft";
}

function getStatusClasses(status: BillDisplayStatus) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "due_today") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "overdue") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "draft") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  return "border-amber-100 bg-amber-50 text-amber-700";
}

export function StatusBadge({
  status,
  className = "",
}: {
  status: BillDisplayStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-[12px] font-semibold tracking-[0.01em] transition-colors ${getStatusClasses(status)} ${className}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

export function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClasses =
    tone === "danger"
      ? "bg-rose-50 text-rose-600 ring-rose-100"
      : tone === "warning"
        ? "bg-amber-50 text-amber-600 ring-amber-100"
        : "bg-brand-soft text-brand-primary ring-emerald-100";

  return (
    <article className="group flex h-full min-h-[148px] flex-col justify-between rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ${toneClasses}`}>
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-5 text-[34px] font-semibold tracking-tight text-slate-950 sm:text-[38px]">
        {value}
      </p>
    </article>
  );
}

export function SearchField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="relative block w-full sm:max-w-[320px]">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        {...props}
        className={`min-h-12 w-full rounded-full border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-4 focus:ring-emerald-100 ${props.className ?? ""}`}
      />
    </label>
  );
}

type QuickActionsMenuProps = {
  bill: Bill;
  isOpen: boolean;
  todayIso: string;
  onOpenLink?: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
  onDelete: () => void;
};

export function QuickActionsMenu({
  bill,
  isOpen,
  todayIso,
  onOpenLink,
  onToggle,
  onEdit,
  onMarkPaid,
  onMarkUnpaid,
  onDelete,
}: QuickActionsMenuProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const displayStatus = getBillDisplayStatus(bill, todayIso);
  const isPaid = displayStatus === "paid";
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; openAbove: boolean }>({
    top: 0,
    left: 0,
    openAbove: true,
  });

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) {
      return;
    }

    function updateMenuPosition() {
      if (!buttonRef.current) {
        return;
      }

      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 224;
      const estimatedMenuHeight = 176;
      const viewportPadding = 16;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openAbove = spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight;
      const left = Math.min(
        window.innerWidth - menuWidth - viewportPadding,
        Math.max(viewportPadding, rect.right - menuWidth),
      );
      const top = openAbove
        ? Math.max(viewportPadding, rect.top - estimatedMenuHeight - 8)
        : Math.min(window.innerHeight - estimatedMenuHeight - viewportPadding, rect.bottom + 8);

      setMenuStyle({ top, left, openAbove });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  return (
    <div className="relative" data-bill-menu>
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition duration-150 hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`More actions for ${bill.title}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {createPortal(
        <div
          data-bill-menu
          className={`fixed z-[80] w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.14)] transition duration-150 ${
            isOpen
              ? "pointer-events-auto scale-100 opacity-100"
              : `pointer-events-none opacity-0 ${menuStyle.openAbove ? "translate-y-1 scale-95" : "-translate-y-1 scale-95"}`
          }`}
          style={{ top: menuStyle.top, left: menuStyle.left }}
          role="menu"
          aria-hidden={!isOpen}
        >
          {onOpenLink ? <MenuAction icon={ExternalLink} label="Open link" tone="info" onClick={onOpenLink} /> : null}
          <MenuAction icon={Pen} label="Edit bill" tone="info" onClick={onEdit} />
          <MenuRadioAction
            checked={isPaid}
            label={isPaid ? "Mark as unpaid" : "Mark as paid"}
            onClick={isPaid ? onMarkUnpaid : onMarkPaid}
          />
          <MenuAction icon={Trash2} label="Delete bill" tone="danger" onClick={onDelete} />
        </div>,
        document.body,
      )}
    </div>
  );
}

function MenuAction({
  icon: Icon,
  label,
  tone,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone: "success" | "info" | "danger" | "neutral";
  onClick: () => void;
}) {
  const toneClasses =
    tone === "success"
      ? "text-emerald-700 hover:bg-emerald-50"
      : tone === "info"
        ? "text-slate-950 hover:bg-slate-50"
        : tone === "danger"
          ? "text-red-500 hover:bg-red-50"
          : "text-slate-700 hover:bg-slate-50";

  const iconClasses =
    tone === "success"
      ? "text-emerald-700"
      : tone === "info"
        ? "text-slate-700"
        : tone === "danger"
          ? "text-red-500"
          : "text-slate-600";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-10 w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left text-sm font-medium transition duration-150 last:border-b-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-100 ${toneClasses}`}
      role="menuitem"
    >
      <span className={`grid h-5 w-5 shrink-0 place-items-center ${iconClasses}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span>{label}</span>
    </button>
  );
}

function MenuRadioAction({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-10 w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left text-sm font-medium text-emerald-700 transition duration-150 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-100"
      role="menuitemradio"
      aria-checked={checked}
    >
      {checked ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
      )}
      <span>{label}</span>
    </button>
  );
}

type BillRowProps = {
  bill: Bill;
  todayIso: string;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onPrimaryAction: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkUnpaid: () => void;
};

export function BillRow({
  bill,
  todayIso,
  isMenuOpen,
  onToggleMenu,
  onPrimaryAction,
  onEdit,
  onDelete,
  onMarkUnpaid,
}: BillRowProps) {
  const displayStatus = getBillDisplayStatus(bill, todayIso);
  const isPaid = displayStatus === "paid";

  return (
    <tr className="group border-b border-slate-100 transition duration-150 hover:bg-[#f9fcfb]">
      <td className="px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-sm font-semibold text-brand-primary">
            {bill.title.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-slate-950">{bill.title}</p>
            <p className="mt-0.5 text-[13px] text-slate-500">{bill.frequency ?? "One-time"}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 sm:px-5">
        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[13px] font-medium text-slate-600">
          {bill.category}
        </span>
      </td>
      <td className="px-4 py-4 sm:px-5">
        <span className="text-[16px] font-semibold text-slate-950">
          {formatCurrency(Number(bill.amount))}
        </span>
      </td>
      <td className="px-4 py-4 sm:px-5">
        <span className="text-[15px] text-slate-700">{formatDateShort(bill.due_date)}</span>
      </td>
      <td className="px-4 py-4 sm:px-5">
        <StatusBadge status={displayStatus} />
      </td>
      <td className="px-4 py-4 sm:px-5">
        {isPaid ? (
          <button
            type="button"
            onClick={onMarkUnpaid}
            className="inline-flex min-h-11 items-center gap-3 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition duration-150 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            Reopen
          </button>
        ) : (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="inline-flex min-h-11 items-center gap-3 rounded-full px-2 text-sm font-semibold text-slate-700 transition duration-150 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            <Circle className="h-5 w-5 shrink-0 text-emerald-600 transition duration-150" aria-hidden="true" />
            Mark paid
          </button>
        )}
      </td>
      <td className="px-4 py-4 text-right sm:px-5">
        <QuickActionsMenu
          bill={bill}
          isOpen={isMenuOpen}
          todayIso={todayIso}
          onToggle={onToggleMenu}
          onEdit={onEdit}
          onDelete={onDelete}
          onMarkPaid={onPrimaryAction}
          onMarkUnpaid={onMarkUnpaid}
        />
      </td>
    </tr>
  );
}

type BillMobileCardProps = Omit<BillRowProps, "isMenuOpen" | "onToggleMenu"> & {
  isMenuOpen: boolean;
  onToggleMenu: () => void;
};

export function BillMobileCard({
  bill,
  todayIso,
  isMenuOpen,
  onToggleMenu,
  onPrimaryAction,
  onEdit,
  onDelete,
  onMarkUnpaid,
}: BillMobileCardProps) {
  const displayStatus = getBillDisplayStatus(bill, todayIso);
  const isPaid = displayStatus === "paid";

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] transition duration-150 hover:border-slate-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[16px] font-semibold text-slate-950">{bill.title}</p>
          <p className="mt-1 text-[13px] text-slate-500">
            {bill.category} · {bill.frequency ?? "One-time"}
          </p>
        </div>
        <QuickActionsMenu
          bill={bill}
          isOpen={isMenuOpen}
          todayIso={todayIso}
          onToggle={onToggleMenu}
          onEdit={onEdit}
          onDelete={onDelete}
          onMarkPaid={onPrimaryAction}
          onMarkUnpaid={onMarkUnpaid}
        />
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[28px] font-semibold tracking-tight text-slate-950">
            {formatCurrency(Number(bill.amount))}
          </p>
          <p className="mt-1 text-[13px] text-slate-500">Due {formatDateShort(bill.due_date)}</p>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      <div className="mt-5">
        {isPaid ? (
          <button
            type="button"
            onClick={onMarkUnpaid}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition duration-150 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            Reopen bill
          </button>
        ) : (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition duration-150 hover:border-emerald-300 hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            <Circle className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            Mark paid
          </button>
        )}
      </div>
    </article>
  );
}

export function BillsEmptyState({
  onAddBill,
  hasFilters,
}: {
  onAddBill: () => void;
  hasFilters: boolean;
}) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-brand-soft text-brand-primary">
          <CreditCard className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-xl font-semibold text-slate-950">
          {hasFilters ? "No matching bills" : "No bills yet"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {hasFilters
            ? "Try a different filter or search term to find the bill you need."
            : "Add your first bill to begin tracking payments."}
        </p>
        {!hasFilters ? (
          <button
            type="button"
            onClick={onAddBill}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-primary px-5 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            <CreditCard className="h-4 w-4" />
            Add bill
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const billsSummaryIcons = {
  total_unpaid: Wallet,
  due_this_week: CalendarClock,
  overdue: AlertCircle,
  paid: CheckCircle2,
  upcoming: Clock3,
};
