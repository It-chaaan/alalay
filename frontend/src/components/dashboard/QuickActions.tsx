import { useEffect, useId, useState } from "react";

function Icon({ type }: { type: "bill" | "expense" | "scan" | "plus" | "close" | "help" }) {
  const common = "h-4 w-4";

  if (type === "expense") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7h16v11H4z" />
        <path d="M16 11h4v4h-4z" />
      </svg>
    );
  }

  if (type === "scan") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 4H4v3M20 7V4h-3M4 17v3h3M20 17v3h-3" />
        <path d="M9 12h6" />
      </svg>
    );
  }

  if (type === "close") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    );
  }

  if (type === "plus") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }

  if (type === "help") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9.1 9a3 3 0 1 1 5.2 2c-.8.7-1.3 1.2-1.3 2.5" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

export function QuickActions() {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      <div
        id={menuId}
        aria-hidden={!isOpen}
        className={`flex flex-col items-end gap-3 transition duration-200 ${
          isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
          <a href="/app/bills?action=add-bill" tabIndex={isOpen ? 0 : -1} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-xl transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2">
            <Icon type="bill" />
            Add bill
          </a>
          <a href="/app/expenses?action=log-expense" tabIndex={isOpen ? 0 : -1} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-xl transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2">
            <Icon type="expense" />
            Log expense
          </a>
          <a href="/app/ocr-scanner" tabIndex={isOpen ? 0 : -1} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-xl transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2">
            <Icon type="scan" />
            Scan receipt
          </a>
      </div>
      <button
        type="button"
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
        onClick={() => setIsOpen((current) => !current)}
        className="grid h-12 w-12 place-items-center rounded-full bg-brand-primary text-white shadow-xl transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
      >
        <Icon type={isOpen ? "close" : "plus"} />
      </button>
      <button type="button" aria-label="Help" className="absolute -bottom-1 -right-2 grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-white shadow-lg ring-2 ring-slate-700">
        <Icon type="help" />
      </button>
    </div>
  );
}
