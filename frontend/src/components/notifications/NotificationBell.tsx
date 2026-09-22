import { Bell, CheckCheck, Settings, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/apiClient';

export type InAppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  related_bill_id?: string | null;
  related_subscription_id?: string | null;
  related_wallet_id?: string | null;
};
function hrefFor(item: InAppNotification) {
  return item.related_bill_id || item.type.startsWith('bill_')
    ? '/app/bills'
    : item.related_subscription_id || item.type.startsWith('subscription_')
      ? '/app/subscriptions'
      : item.related_wallet_id
        ? '/app/wallets'
        : item.type === 'savings_milestone'
          ? '/app/goals'
          : '/app';
}
function dateFor(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextItems, nextUnread] = await Promise.all([
        apiRequest<InAppNotification[]>('/notifications'),
        apiRequest<{ count: number }>('/notifications/unread-count'),
      ]);
      setItems(nextItems);
      setUnread(nextUnread.count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Notifications could not load.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  async function markAll() {
    if (!unread) return;
    await apiRequest('/notifications/read', { method: 'POST' });
    setItems((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })),
    );
    setUnread(0);
  }
  async function markRead(item: InAppNotification) {
    if (item.read_at) return;
    await apiRequest(`/notifications/${item.id}/read`, { method: 'POST' });
    setItems((current) =>
      current.map((row) =>
        row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row,
      ),
    );
    setUnread((current) => Math.max(0, current - 1));
  }
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={unread ? `Notifications: ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <Bell aria-hidden="true" className="h-4 w-4" />
        {unread ? (
          <span
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-primary"
            aria-hidden="true"
          />
        ) : null}
      </button>
      {open ? (
        <section
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-950 dark:text-white">Notifications</h2>
              <p className="text-xs text-slate-500">
                {unread ? `${unread} unread` : 'All caught up'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void markAll()}
                disabled={!unread}
                aria-label="Mark all notifications as read"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
              >
                <CheckCheck className="h-4 w-4" />
              </button>
              <a
                href="/app/settings?tab=notifications"
                aria-label="Notification settings"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <Settings className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
            {loading ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">
                Loading notifications...
              </p>
            ) : error ? (
              <div className="px-3 py-8 text-center text-sm text-red-600">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="mt-2 font-semibold underline"
                >
                  Try again
                </button>
              </div>
            ) : items.length ? (
              items.slice(0, 8).map((item) => (
                <a
                  key={item.id}
                  href={hrefFor(item)}
                  onClick={() => void markRead(item)}
                  className={`block rounded-xl px-3 py-3 hover:bg-slate-50 ${item.read_at ? '' : 'bg-brand-muted/40'}`}
                >
                  <div className="flex gap-2">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.read_at ? 'bg-slate-200' : 'bg-brand-primary'}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.body}</p>
                      <p className="mt-2 text-[11px] text-slate-400">{dateFor(item.created_at)}</p>
                    </div>
                  </div>
                </a>
              ))
            ) : (
              <p className="px-3 py-8 text-center text-sm text-slate-500">No notifications yet.</p>
            )}
          </div>
          <a
            href="/app/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-3 text-center text-sm font-semibold text-brand-primary hover:bg-slate-50"
          >
            View all notifications
          </a>
        </section>
      ) : null}
    </div>
  );
}
