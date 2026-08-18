import type { Session } from '@supabase/supabase-js';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { institutionFor } from '@shared/institution-registry';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { SearchField } from '../../components/dashboard/BillsComponents';
import { controlSurfaceClass } from '../../components/ui/ControlSurface';
import { SlideOver } from '../../components/ui/SlideOver';
import { PageSkeleton, SlowLoadNotice } from '../../components/ui/Skeleton';
import { DeleteWalletDialog, WalletActionsMenu } from '../../components/wallets/WalletActions';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useBalancePrivacy } from '../../hooks/useBalancePrivacy';
import type { Wallet } from '../../hooks/types';
import { formatCurrency, formatDateShort } from '../../utils/formatters';
import { DepositForm, EditWalletForm, TransferForm } from './WalletsPage';

type WalletTransaction = {
  id: string;
  kind: string;
  label: string;
  category?: string | null;
  date: string;
  amount: number | string;
};

type WalletDetail = {
  wallet: Wallet;
  transactions: WalletTransaction[];
  transactionError?: string;
};

type TransactionFilter = 'all' | 'income' | 'expense' | 'transfer' | 'adjustment';

function getName(session: Session) {
  return session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Juan';
}

function institutionTypeLabel(type: Wallet['institution_type']) {
  const labels: Record<Wallet['institution_type'], string> = {
    cash: 'Cash',
    bank: 'Bank',
    digital_bank: 'Digital bank',
    e_wallet: 'E-wallet',
    other: 'Other',
  };
  return labels[type];
}

function transactionGroup(kind: string): TransactionFilter {
  if (kind === 'income') return 'income';
  if (kind === 'expense' || kind === 'bill') return 'expense';
  if (kind.startsWith('transfer')) return 'transfer';
  return 'adjustment';
}

function transactionPresentation(transaction: WalletTransaction, isCredit: boolean) {
  const rawAmount = Number(transaction.amount);
  if (!isCredit) {
    return {
      amount: rawAmount,
      direction: rawAmount >= 0 ? 'Money in' : 'Money out',
    };
  }

  const increasesLiability = transaction.kind === 'expense' || transaction.kind === 'bill';
  return {
    amount: increasesLiability ? Math.abs(rawAmount) : -Math.abs(rawAmount),
    direction: increasesLiability ? 'Liability increased' : 'Liability reduced',
  };
}

function SummaryCard({
  wallet,
  isPrivate,
  onEdit,
  onDelete,
}: {
  wallet: Wallet;
  isPrivate: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { settings } = useAppPreferences();
  const institution = institutionFor(wallet.institution_key);
  const isCredit = wallet.account_type === 'credit';
  const balance = Number(wallet.balance);
  const creditLimit = Number(wallet.credit_limit ?? 0);
  const availableCredit = Math.max(0, creditLimit - balance);
  const hidden = '••••••';
  const meta = [
    institutionTypeLabel(wallet.institution_type),
    wallet.account_type
      ? wallet.account_type[0].toUpperCase() + wallet.account_type.slice(1)
      : null,
    settings.currency,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article
      className="relative min-h-[320px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#075b49] via-[#0f8a6b] to-[#39b98f] p-6 text-white shadow-lg sm:p-8"
      aria-label={`${wallet.name} ${isCredit ? 'credit account' : 'wallet'} summary`}
    >
      <div className="relative z-10 flex items-start justify-between gap-4">
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl bg-white/95 text-lg font-black shadow-sm"
          style={{ color: wallet.color || institution.brandColor }}
          aria-hidden="true"
        >
          {institution.mark}
        </span>
        <div className="flex items-center gap-1">
          {isCredit ? (
            <CreditCard className="h-6 w-6 text-white/80" aria-hidden="true" />
          ) : (
            <WalletCards className="h-6 w-6 text-white/80" aria-hidden="true" />
          )}
          <WalletActionsMenu
            walletName={wallet.name}
            onEdit={onEdit}
            onDelete={onDelete}
            inverse
            deleteDisabled={wallet.is_default_cash}
          />
        </div>
      </div>
      <div className="relative z-10 mt-7">
        <h2 className="text-2xl font-bold sm:text-3xl">{wallet.name}</h2>
        <p className="mt-1 text-sm font-medium capitalize text-white/75">{meta}</p>
      </div>
      <div className="relative z-10 mt-7 border-t border-white/25 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
          {isCredit ? 'Outstanding' : 'Current balance'}
        </p>
        <p className="mt-2 font-mono text-4xl font-bold sm:text-5xl">
          {isPrivate ? hidden : formatCurrency(balance, true, settings.currency)}
        </p>
        {isCredit ? (
          <div className="mt-5 grid max-w-lg grid-cols-2 gap-5 border-t border-white/20 pt-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/65">Credit limit</p>
              <p className="mt-1 font-mono font-semibold">
                {isPrivate ? hidden : formatCurrency(creditLimit, true, settings.currency)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/65">
                Available credit
              </p>
              <p className="mt-1 font-mono font-semibold">
                {isPrivate ? hidden : formatCurrency(availableCredit, true, settings.currency)}
              </p>
            </div>
          </div>
        ) : null}
      </div>
      <svg
        aria-hidden="true"
        viewBox="0 0 700 180"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full text-white opacity-20"
      >
        <path
          d="M0 145 C80 168, 120 96, 205 120 S330 160, 405 84 S535 124, 610 50 S665 54, 700 38"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          d="M0 145 C80 168, 120 96, 205 120 S330 160, 405 84 S535 124, 610 50 S665 54, 700 38 L700 180 L0 180 Z"
          fill="currentColor"
          opacity="0.15"
        />
      </svg>
    </article>
  );
}

function AboutWallet({ wallet }: { wallet: Wallet }) {
  const { settings } = useAppPreferences();
  const institution = institutionFor(wallet.institution_key);
  const rows = [
    ['Wallet type', institutionTypeLabel(wallet.institution_type)],
    ...(wallet.account_type
      ? [['Account', wallet.account_type === 'credit' ? 'Credit' : 'Debit']]
      : []),
    ['Currency', settings.currency],
    ...(wallet.institution_type !== 'cash' ? [['Institution', institution.displayName]] : []),
    ...(wallet.interest_rate != null
      ? [['Interest rate', `${Number(wallet.interest_rate)}%`]]
      : []),
    ...(wallet.interest_crediting_frequency
      ? [['Interest frequency', wallet.interest_crediting_frequency]]
      : []),
    ...(wallet.default_outgoing_transfer_fee != null
      ? [
          [
            'Default transfer fee',
            formatCurrency(Number(wallet.default_outgoing_transfer_fee), true, settings.currency),
          ],
        ]
      : []),
    ...(wallet.created_at ? [['Created on', formatDateShort(wallet.created_at.slice(0, 10))]] : []),
  ];

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      aria-labelledby="about-wallet-title"
    >
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5 text-brand-primary" aria-hidden="true" />
        <h2 id="about-wallet-title" className="font-semibold">
          About this wallet
        </h2>
      </div>
      <dl className="mt-5 divide-y divide-slate-200 dark:divide-slate-700">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex min-h-12 items-center justify-between gap-4 py-3 text-sm"
          >
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-semibold capitalize text-slate-900 dark:text-white">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TransactionsSection({
  wallet,
  transactions,
  error,
  isPrivate,
  onRetry,
}: {
  wallet: Wallet;
  transactions: WalletTransaction[];
  error?: string;
  isPrivate: boolean;
  onRetry: () => void;
}) {
  const { settings } = useAppPreferences();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const [limit, setLimit] = useState(12);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesFilter = filter === 'all' || transactionGroup(transaction.kind) === filter;
      const searchable =
        `${transaction.label} ${transaction.category ?? ''} ${transaction.kind}`.toLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [filter, search, transactions]);

  return (
    <section className="mt-8" aria-labelledby="wallet-transactions-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Activity
          </p>
          <h2 id="wallet-transactions-title" className="mt-1 text-xl font-bold">
            Transactions
          </h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transactions…"
            aria-label="Search transactions"
            className="sm:w-56"
          />
          <label>
            <span className="sr-only">Filter transactions</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as TransactionFilter)}
              className={`min-h-10 w-full rounded-xl bg-transparent px-3 text-sm font-medium outline-none sm:w-48 ${controlSurfaceClass}`}
            >
              <option value="all">All activity</option>
              <option value="income">Income</option>
              <option value="expense">Expenses & bills</option>
              <option value="transfer">Transfers</option>
              <option value="adjustment">Deposits & adjustments</option>
            </select>
          </label>
        </div>
      </div>
      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <p>{error}</p>
          <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">
            Try again
          </button>
        </div>
      ) : filtered.length ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {filtered.slice(0, limit).map((transaction) => {
            const presentation = transactionPresentation(
              transaction,
              wallet.account_type === 'credit',
            );
            const incoming = presentation.amount >= 0;
            return (
              <article
                key={`${transaction.kind}-${transaction.id}`}
                className="flex items-center gap-3 border-b border-slate-200 px-4 py-4 last:border-0 dark:border-slate-700 sm:px-5"
                aria-label={`${transaction.label}, ${presentation.direction}, ${isPrivate ? 'amount hidden' : formatCurrency(Math.abs(presentation.amount), true, settings.currency)}`}
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${incoming ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
                >
                  {transaction.kind.startsWith('transfer') ? (
                    <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
                  ) : incoming ? (
                    <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                    {transaction.label}
                  </h3>
                  <p className="mt-1 text-xs capitalize text-slate-500">
                    {transaction.category ?? transaction.kind.replaceAll('_', ' ')} ·{' '}
                    {formatDateShort(transaction.date.slice(0, 10))}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`font-mono text-sm font-bold ${incoming ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-950 dark:text-white'}`}
                  >
                    {isPrivate
                      ? '••••••'
                      : `${incoming ? '+' : '−'}${formatCurrency(Math.abs(presentation.amount), true, settings.currency)}`}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">{presentation.direction}</p>
                </div>
              </article>
            );
          })}
          {filtered.length > limit ? (
            <div className="border-t border-slate-200 p-3 text-center dark:border-slate-700">
              <button
                type="button"
                onClick={() => setLimit((current) => current + 12)}
                className="min-h-10 rounded-xl px-4 text-sm font-semibold text-brand-primary hover:bg-brand-soft"
              >
                Load more
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <p className="font-semibold">
            {transactions.length ? 'No matching transactions.' : 'No transactions yet.'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {transactions.length
              ? 'Try another search or filter.'
              : 'Transactions involving this wallet will appear here.'}
          </p>
        </div>
      )}
    </section>
  );
}

export function WalletDetailsPage({
  session,
  onSignOut,
  walletId,
}: {
  session: Session;
  onSignOut: () => void;
  walletId: string;
}) {
  const detailQuery = useApiQuery<WalletDetail>(`/wallets/${walletId}`);
  const walletsQuery = useApiQuery<Wallet[]>('/wallets');
  const { isPrivate, togglePrivacy } = useBalancePrivacy();
  const [editing, setEditing] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteMutation = useApiMutation();
  const wallet = detailQuery.data?.wallet;
  const liquidWallets = (walletsQuery.data ?? []).filter((item) => item.account_type !== 'credit');

  function refresh() {
    detailQuery.refetch();
    walletsQuery.refetch();
  }

  async function deleteWallet() {
    if (!wallet) return;
    try {
      await deleteMutation.mutate(`/wallets/${wallet.id}`, { method: 'DELETE' });
      window.location.assign('/app/wallets');
    } catch {
      // Keep the dialog open so its domain-safe API error remains visible.
    }
  }

  return (
    <DashboardShell
      activeLabel="Wallets"
      title="Wallet details"
      subtitle="Account overview and wallet-specific activity"
      name={getName(session)}
      onSignOut={onSignOut}
    >
      <a
        href="/app/wallets"
        className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl pr-3 text-sm font-semibold text-slate-600 hover:text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/50 dark:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to wallets
      </a>
      {detailQuery.isLoading ? (
        <>
          <PageSkeleton kind="budget" />
          <SlowLoadNotice show={detailQuery.isSlowLoading} />
        </>
      ) : null}
      {detailQuery.error || (!detailQuery.isLoading && !wallet) ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <WalletCards className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold">Wallet not found</h2>
          <p className="mt-2 text-sm text-slate-500">
            {detailQuery.error ?? 'This wallet is unavailable or no longer exists.'}
          </p>
          <a
            href="/app/wallets"
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-primary px-5 text-sm font-semibold text-white"
          >
            Back to wallets
          </a>
        </section>
      ) : null}
      {wallet ? (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
            <div>
              <SummaryCard
                wallet={wallet}
                isPrivate={isPrivate}
                onEdit={() => setEditing(true)}
                onDelete={() => setDeleting(true)}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                {wallet.account_type !== 'credit' ? (
                  <button
                    type="button"
                    onClick={() => setDepositing(true)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark sm:flex-none"
                  >
                    <ArrowDownToLine className="h-4 w-4" aria-hidden="true" /> Deposit
                  </button>
                ) : null}
                {wallet.account_type !== 'credit' && liquidWallets.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setTransferring(true)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-brand-primary px-5 text-sm font-semibold text-brand-primary hover:bg-brand-soft sm:flex-none"
                  >
                    <ArrowLeftRight className="h-4 w-4" aria-hidden="true" /> Transfer
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={togglePrivacy}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label={isPrivate ? 'Show wallet amounts' : 'Hide wallet amounts'}
                >
                  {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {isPrivate ? 'Show amounts' : 'Hide amounts'}
                </button>
              </div>
            </div>
            <AboutWallet wallet={wallet} />
          </div>
          <TransactionsSection
            wallet={wallet}
            transactions={detailQuery.data?.transactions ?? []}
            error={detailQuery.data?.transactionError}
            isPrivate={isPrivate}
            onRetry={detailQuery.refetch}
          />
          <SlideOver
            open={editing}
            onClose={() => setEditing(false)}
            title="Edit wallet"
            description="Update wallet metadata without changing its accounting identity."
          >
            <EditWalletForm wallet={wallet} onClose={() => setEditing(false)} onSaved={refresh} />
          </SlideOver>
          <SlideOver
            open={depositing}
            onClose={() => setDepositing(false)}
            title="Deposit"
            description={`Add money directly to ${wallet.name}.`}
          >
            <DepositForm wallet={wallet} onClose={() => setDepositing(false)} onSaved={refresh} />
          </SlideOver>
          <SlideOver
            open={transferring}
            onClose={() => setTransferring(false)}
            title="Transfer between wallets"
            description={`${wallet.name} is preselected as the source.`}
          >
            <TransferForm
              wallets={liquidWallets}
              initialFrom={wallet.id}
              onClose={() => setTransferring(false)}
              onSaved={refresh}
            />
          </SlideOver>
          <DeleteWalletDialog
            open={deleting}
            walletName={wallet.name}
            isDeleting={deleteMutation.isSubmitting}
            error={deleteMutation.error}
            onClose={() => {
              deleteMutation.reset();
              setDeleting(false);
            }}
            onConfirm={() => void deleteWallet()}
          />
        </>
      ) : null}
    </DashboardShell>
  );
}
