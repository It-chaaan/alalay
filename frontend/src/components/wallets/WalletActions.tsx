import { MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';

export function WalletActionsMenu({
  walletName,
  onEdit,
  onDelete,
  inverse = false,
  deleteDisabled = false,
}: {
  walletName: string;
  onEdit: () => void;
  onDelete: () => void;
  inverse?: boolean;
  deleteDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    const close = (event: KeyboardEvent | globalThis.MouseEvent) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') setOpen(false);
      if (
        event instanceof globalThis.MouseEvent &&
        !rootRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', close);
    window.addEventListener('mousedown', close);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('mousedown', close);
    };
  }, [open]);

  function stop(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div ref={rootRef} className="relative z-20" onClick={stop}>
      <button
        type="button"
        aria-label={`More actions for ${walletName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          stop(event);
          setOpen((current) => !current);
        }}
        className={`grid h-10 w-10 place-items-center rounded-xl transition focus:outline-none focus:ring-2 focus:ring-brand-primary/50 ${
          inverse
            ? 'text-white/90 hover:bg-white/15 focus:ring-white/70'
            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={`Actions for ${walletName}`}
          className="absolute right-0 top-full mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-sm text-slate-800 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <button
            ref={firstItemRef}
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left font-medium hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:hover:bg-slate-800 dark:focus:bg-slate-800"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" /> Edit wallet
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={deleteDisabled}
            title={deleteDisabled ? 'The default Cash wallet cannot be deleted.' : undefined}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left font-medium text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45 dark:text-red-400 dark:hover:bg-red-950/30 dark:focus:bg-red-950/30"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete wallet
          </button>
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <button
            role="menuitem"
            type="button"
            onClick={() => setOpen(false)}
            className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-slate-500 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:hover:bg-slate-800 dark:focus:bg-slate-800"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Close menu
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function DeleteWalletDialog({
  walletName,
  open,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: {
  walletName: string;
  open: boolean;
  isDeleting: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [isDeleting, onClose, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center px-5">
      <button
        type="button"
        aria-label="Cancel wallet deletion"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-wallet-title"
        aria-describedby="delete-wallet-description"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <Trash2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 id="delete-wallet-title" className="mt-4 text-xl font-bold">
          Delete {walletName}?
        </h2>
        <p id="delete-wallet-description" className="mt-2 text-sm leading-6 text-slate-500">
          Linked financial history is preserved. The default Cash wallet, transfers, loans, and
          other protected relationships may prevent deletion.
        </p>
        {error ? (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="min-h-11 rounded-xl px-4 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="min-h-11 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isDeleting ? 'Deleting…' : 'Delete wallet'}
          </button>
        </div>
      </section>
    </div>
  );
}
