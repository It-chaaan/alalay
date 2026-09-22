import { CheckCheck, Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { DashboardShell } from '../../components/layout/DashboardShell';
import type { InAppNotification } from '../../components/notifications/NotificationBell';
import { apiRequest } from '../../lib/apiClient';

const filters = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['reminders', 'Reminders'],
  ['alerts', 'Alerts'],
  ['updates', 'Updates'],
] as const;
function groupFor(type: string) {
  return type.includes('bill') || type.includes('renewal')
    ? 'reminders'
    : type.includes('warning') || type.includes('overdue')
      ? 'alerts'
      : 'updates';
}
function destination(item: InAppNotification) {
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
export function NotificationsPage({
  session,
  onSignOut,
}: {
  session: Session;
  onSignOut: () => void;
}) {
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number][0]>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = () => {
    setLoading(true);
    setError('');
    void apiRequest<InAppNotification[]>('/notifications')
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Notifications could not load.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const unread = items.filter((item) => !item.read_at).length;
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          filter === 'all' ||
          (filter === 'unread' ? !item.read_at : groupFor(item.type) === filter),
      ),
    [filter, items],
  );
  async function markAll() {
    await apiRequest('/notifications/read', { method: 'POST' });
    setItems((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })),
    );
  }
  async function markRead(item: InAppNotification) {
    if (item.read_at) return;
    await apiRequest(`/notifications/${item.id}/read`, { method: 'POST' });
    setItems((current) =>
      current.map((row) =>
        row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row,
      ),
    );
  }
  return (
    <DashboardShell
      activeLabel="Notifications"
      title="Notifications"
      subtitle="Stay up to date with your Alalay activity"
      name={session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Alalay'}
      onSignOut={onSignOut}
      action={
        <>
          <a
            href="/app/settings?tab=notifications"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Settings className="h-4 w-4" /> Notification settings
          </a>
          {unread ? (
            <button
              type="button"
              onClick={() => void markAll()}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
          ) : null}
        </>
      }
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-xl px-3 py-2 text-sm ${filter === value ? 'bg-brand-muted font-semibold text-brand-primary' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {label}
              {value === 'unread' ? ` (${unread})` : ''}
            </button>
          ))}
        </div>
      </div>
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-10 text-center text-sm text-slate-500">Loading notifications...</p>
        ) : error ? (
          <div className="p-10 text-center text-sm text-red-600">
            <p>{error}</p>
            <button type="button" onClick={load} className="mt-2 font-semibold underline">
              Try again
            </button>
          </div>
        ) : visible.length ? (
          visible.map((item) => (
            <a
              key={item.id}
              href={destination(item)}
              onClick={() => void markRead(item)}
              className={`flex gap-4 border-b border-slate-100 px-5 py-4 last:border-0 hover:bg-slate-50 ${item.read_at ? '' : 'bg-brand-muted/30'}`}
            >
              <span
                className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.read_at ? 'bg-slate-200' : 'bg-brand-primary'}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-950">{item.title}</span>
                <span className="mt-1 block text-sm text-slate-600">{item.body}</span>
                <span className="mt-2 block text-xs text-slate-400">
                  {new Intl.DateTimeFormat('en', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(item.created_at))}
                </span>
              </span>
            </a>
          ))
        ) : (
          <p className="p-10 text-center text-sm text-slate-500">
            {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
          </p>
        )}
      </section>
    </DashboardShell>
  );
}
