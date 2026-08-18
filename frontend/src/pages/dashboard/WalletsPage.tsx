import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronRight,
  Eye,
  EyeOff,
  Grid2X2,
  HandCoins,
  List,
  Plus,
  Send,
  SlidersHorizontal,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { institutionFor, institutionRegistry } from '@shared/institution-registry';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { SlideOver } from '../../components/ui/SlideOver';
import { PageSkeleton, SlowLoadNotice } from '../../components/ui/Skeleton';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useApiQuery } from '../../hooks/useApiQuery';
import type { LoanSummary, Wallet } from '../../hooks/types';
import { formatCurrency } from '../../utils/formatters';
import { SearchField } from '../../components/dashboard/BillsComponents';

type Loan = {
  id: string;
  counterparty: string;
  direction: 'lent' | 'borrowed';
  outstanding_principal: number;
  status: 'active' | 'paid' | 'written_off';
};
type LoansResponse = { loans: Loan[]; summary: LoanSummary };
type WalletFormProps = { onClose: () => void; onSaved: () => void };
type WalletView = 'grid' | 'list';
type WalletFilters = {
  asset: 'all' | 'liquid' | 'credit';
  institution: 'all' | 'cash' | 'bank' | 'e_wallet';
  account: 'all' | 'debit' | 'credit';
};

const defaultWalletFilters: WalletFilters = {
  asset: 'all',
  institution: 'all',
  account: 'all',
};

function getName(session: Session) {
  return session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Juan';
}

function requestKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function InstitutionMark({ wallet }: { wallet: Wallet }) {
  const institution = institutionFor(wallet.institution_key);
  return (
    <span
      className="grid h-11 w-11 place-items-center rounded-2xl text-sm font-bold text-white shadow-sm"
      style={{ backgroundColor: wallet.color || institution.brandColor }}
      aria-hidden="true"
    >
      {institution.mark}
    </span>
  );
}

function WalletCard({ wallet, isPrivate }: { wallet: Wallet; isPrivate: boolean }) {
  const isCredit = wallet.account_type === 'credit';
  const label = wallet.account_type
    ? `${wallet.account_type} · PHP`
    : `${wallet.institution_type.replace('_', ' ')} · PHP`;
  return (
    <article className="min-h-36 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-primary/35 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <InstitutionMark wallet={wallet} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-950 dark:text-white">{wallet.name}</h3>
          <p className="mt-1 text-xs capitalize text-slate-500">{label}</p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 text-slate-400" aria-hidden="true" />
      </div>
      <div className="mt-5">
        <p className="font-mono text-xl font-bold text-slate-950 dark:text-white">
          {isPrivate ? '••••••' : formatCurrency(Number(wallet.balance), true)}
        </p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
          {isCredit ? 'Outstanding' : 'Balance'}
        </p>
      </div>
      {wallet.interest_rate ? (
        <p className="mt-2 text-xs text-slate-500">
          {wallet.interest_rate}% interest · actual credits only
        </p>
      ) : null}
    </article>
  );
}

function WalletList({ wallets, isPrivate }: { wallets: Wallet[]; isPrivate: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(130px,1fr)_minmax(130px,0.8fr)_minmax(120px,0.7fr)_24px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 md:grid">
        <span>Wallet</span><span>Account</span><span>Balance</span><span>Class</span><span />
      </div>
      {wallets.map((wallet) => {
        const isCredit = wallet.account_type === 'credit';
        const account = wallet.account_type
          ? `${wallet.institution_type.replace('_', ' ')} · ${wallet.account_type}`
          : wallet.institution_type.replace('_', ' ');
        return (
          <div
            key={wallet.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-200 px-4 py-4 transition last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60 md:grid-cols-[minmax(0,1.6fr)_minmax(130px,1fr)_minmax(130px,0.8fr)_minmax(120px,0.7fr)_24px] md:items-center md:gap-4 md:px-5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <InstitutionMark wallet={wallet} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-950 dark:text-white">{wallet.name}</p>
                <p className="mt-1 text-xs capitalize text-slate-500 md:hidden">{account} · PHP</p>
              </div>
            </div>
            <p className="hidden text-xs capitalize text-slate-500 md:block">{account} · PHP</p>
            <p className={`font-mono text-sm font-bold md:text-base ${isCredit ? 'text-rose-600' : 'text-slate-950 dark:text-white'}`}>
              {isPrivate ? '••••••' : formatCurrency(Number(wallet.balance), true)}
            </p>
            <span className={`justify-self-end rounded-full px-2.5 py-1 text-[11px] font-semibold md:justify-self-start ${isCredit ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
              {isCredit ? 'Credit liability' : 'Liquid'}
            </span>
            <ChevronRight className="hidden h-5 w-5 text-slate-400 md:block" aria-hidden="true" />
          </div>
        );
      })}
    </div>
  );
}

function WalletFilterPopover({ filters, onChange, onClear }: { filters: WalletFilters; onChange: (filters: WalletFilters) => void; onClear: () => void }) {
  return (
    <div role="dialog" aria-label="Filter wallets" className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Filter wallets</p>
        <button type="button" onClick={onClear} className="text-xs font-semibold text-brand-primary hover:text-brand-dark">Clear</button>
      </div>
      <label className="mt-4 block text-xs font-semibold text-slate-600 dark:text-slate-300">Asset type
        <select value={filters.asset} onChange={(event) => onChange({ ...filters, asset: event.target.value as WalletFilters['asset'] })} className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
          <option value="all">All wallets</option><option value="liquid">Liquid assets</option><option value="credit">Credit liabilities</option>
        </select>
      </label>
      <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-300">Institution
        <select value={filters.institution} onChange={(event) => onChange({ ...filters, institution: event.target.value as WalletFilters['institution'] })} className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 capitalize dark:border-slate-700 dark:bg-slate-950">
          <option value="all">All institutions</option><option value="cash">Cash</option><option value="bank">Bank</option><option value="e_wallet">E-wallet</option>
        </select>
      </label>
      <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-300">Account classification
        <select value={filters.account} onChange={(event) => onChange({ ...filters, account: event.target.value as WalletFilters['account'] })} className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 capitalize dark:border-slate-700 dark:bg-slate-950">
          <option value="all">All accounts</option><option value="debit">Debit</option><option value="credit">Credit</option>
        </select>
      </label>
    </div>
  );
}

function WalletQuickActions({ onAdd, onTransfer, onLoans }: { onAdd: () => void; onTransfer: () => void; onLoans: () => void }) {
  const actions = [
    { label: 'Add wallet', helper: 'New account', icon: Plus, onClick: onAdd },
    { label: 'Transfer money', helper: 'Move funds', icon: ArrowLeftRight, onClick: onTransfer },
    { label: 'Record loan', helper: 'Lend or borrow', icon: HandCoins, onClick: onLoans },
    { label: 'Make repayment', helper: 'Pay or receive', icon: WalletCards, onClick: onLoans },
    { label: 'View all loans & debt', helper: 'Open overview', icon: ArrowRight, onClick: onLoans },
  ];
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="wallet-quick-actions">
      <h2 id="wallet-quick-actions" className="font-semibold text-slate-950 dark:text-white">Quick actions</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {actions.map(({ label, helper, icon: Icon, onClick }) => (
          <button key={label} type="button" onClick={onClick} className="flex min-h-16 items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 dark:hover:bg-slate-800">
            <Icon className="h-5 w-5 shrink-0 text-brand-primary" aria-hidden="true" />
            <span><span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">{label}</span><span className="mt-0.5 block text-[11px] text-slate-500">{helper}</span></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function WalletForm({ onClose, onSaved }: WalletFormProps) {
  const { mutate, isSubmitting, error } = useApiMutation();
  const [institutionKey, setInstitutionKey] = useState('gcash');
  const [name, setName] = useState('GCash');
  const [openingBalance, setOpeningBalance] = useState('');
  const [accountType, setAccountType] = useState<'debit' | 'credit' | ''>('');
  const [creditLimit, setCreditLimit] = useState('');
  const institution = institutionFor(institutionKey);
  const canClassify = institution.supportedAccountTypes.length > 0;
  function selectInstitution(key: string) {
    const selected = institutionFor(key);
    setInstitutionKey(key);
    setName(selected.displayName);
    setAccountType('');
    setCreditLimit('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate<Wallet>('/wallets/with-opening-balance', {
      method: 'POST',
      body: JSON.stringify({
        name,
        institution_type: institution.institutionType,
        institution_key: institution.id,
        account_type: canClassify && accountType ? accountType : null,
        credit_limit: accountType === 'credit' && creditLimit ? Number(creditLimit) : null,
        color: institution.brandColor,
        opening_balance: Number(openingBalance || 0),
      }),
    });
    onSaved();
    setOpeningBalance('');
    setCreditLimit('');
    onClose();
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
        Institution
        <select
          value={institutionKey}
          onChange={(event) => selectInstitution(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-950 outline-none focus:ring-2 focus:ring-brand-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          {institutionRegistry.map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName} · {item.institutionType.replace('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
        Wallet name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-950 outline-none focus:ring-2 focus:ring-brand-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </label>
      {canClassify ? (
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
          Account type
          <select
            value={accountType}
            onChange={(event) => setAccountType(event.target.value as 'debit' | 'credit' | '')}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-950 outline-none focus:ring-2 focus:ring-brand-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">Not specified</option>
            {institution.supportedAccountTypes.map((type) => (
              <option key={type} value={type}>
                {type === 'credit' ? 'Credit' : 'Debit'}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <CurrencyInput
        id="wallet-opening-balance"
        label={accountType === 'credit' ? 'Outstanding balance' : 'Opening balance'}
        value={openingBalance}
        onChange={setOpeningBalance}
      />
      {accountType === 'credit' ? (
        <CurrencyInput
          id="wallet-credit-limit"
          label="Credit limit"
          value={creditLimit}
          onChange={setCreditLimit}
        />
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-full px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          disabled={isSubmitting}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? 'Saving…' : 'Save wallet'}
        </button>
      </div>
    </form>
  );
}

function TransferForm({
  wallets,
  onSaved,
  onClose,
}: {
  wallets: Wallet[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const { mutate, isSubmitting, error } = useApiMutation();
  const [fromWallet, setFromWallet] = useState('');
  const [toWallet, setToWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const canTransfer = wallets.length > 1;
  const amountValue = Number(amount || 0);
  const feeValue = Number(fee || 0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate('/wallets/transfers', {
      method: 'POST',
      body: JSON.stringify({
        from_wallet_id: fromWallet,
        to_wallet_id: toWallet,
        amount: amountValue,
        fee: feeValue,
        date: new Date().toISOString().slice(0, 10),
        transfer_method: 'other',
        idempotency_key: requestKey(),
      }),
    });
    setAmount('');
    setFee('');
    onSaved();
    onClose();
  }
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-primary">
          <ArrowLeftRight className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold">Transfer between wallets</h2>
          <p className="mt-1 text-sm text-slate-500">
            Move money between your accounts. Fees are tracked separately.
          </p>
        </div>
      </div>
      {canTransfer ? (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-end">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              From wallet
              <select
                required
                value={fromWallet}
                onChange={(event) => setFromWallet(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Select wallet</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </option>
                ))}
              </select>
            </label>
            <ArrowRight className="mb-3 hidden h-5 w-5 text-brand-primary md:block" />
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              To wallet
              <select
                required
                value={toWallet}
                onChange={(event) => setToWallet(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Select wallet</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <CurrencyInput
              id="transfer-amount"
              label="Amount"
              value={amount}
              onChange={setAmount}
            />
            <CurrencyInput id="transfer-fee" label="Transfer fee" value={fee} onChange={setFee} />
          </div>
          {amountValue > 0 ? (
            <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-3 dark:bg-slate-800/60">
              <p>
                <span className="block text-xs text-slate-500">You send</span>
                <strong>{formatCurrency(amountValue + feeValue, true)}</strong>
              </p>
              <p>
                <span className="block text-xs text-slate-500">Destination receives</span>
                <strong>{formatCurrency(amountValue, true)}</strong>
              </p>
              <p>
                <span className="block text-xs text-slate-500">Transfer fee</span>
                <strong>{formatCurrency(feeValue, true)}</strong>
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/60">
          Add another non-credit wallet to transfer money.
        </p>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
        {error ? <p className="text-sm text-red-600">{error}</p> : <span />}
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-lg px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          disabled={!canTransfer || isSubmitting}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-primary px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {isSubmitting ? 'Transferring…' : 'Transfer'}
        </button>
      </div>
    </form>
  );
}

function LoansDebtCard({
  data,
  onOpen,
  isPrivate,
}: {
  data: LoansResponse | null;
  onOpen: () => void;
  isPrivate: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-brand-primary/35 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Loans &amp; Debt</h2>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
          <UserRound className="h-5 w-5 text-emerald-600" />
          <p className="mt-4 text-sm text-slate-500">Owed to me</p>
          <p className="mt-1 font-mono text-lg font-bold">
            {isPrivate ? '••••••' : formatCurrency(data?.summary.owed_to_me ?? 0, true)}
          </p>
        </div>
        <div className="rounded-2xl bg-rose-50 p-4 dark:bg-rose-950/30">
          <HandCoins className="h-5 w-5 text-rose-600" />
          <p className="mt-4 text-sm text-slate-500">I owe</p>
          <p className="mt-1 font-mono text-lg font-bold">
            {isPrivate ? '••••••' : formatCurrency(data?.summary.i_owe ?? 0, true)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-500">Track what you owe and what’s owed to you.</p>
    </button>
  );
}

export function WalletsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const walletsQuery = useApiQuery<Wallet[]>('/wallets');
  const loansQuery = useApiQuery<LoansResponse>('/loans');
  const [isAddWalletOpen, setIsAddWalletOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isLoansOpen, setIsLoansOpen] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<WalletFilters>(defaultWalletFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [view, setView] = useState<WalletView>(() => {
    try {
      return window.localStorage.getItem('alalay-wallet-view') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const wallets = walletsQuery.data ?? [];
  const liquidWallets = wallets.filter((wallet) => wallet.account_type !== 'credit');
  const liquidBalance = useMemo(
    () => liquidWallets.reduce((total, wallet) => total + Number(wallet.balance), 0),
    [liquidWallets],
  );
  const visibleWallets = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/[-_]/g, ' ');
    return wallets.filter((wallet) => {
      const institution = institutionFor(wallet.institution_key);
      const searchable = [
        wallet.name,
        institution.displayName,
        institution.id,
        ...institution.aliases,
        wallet.institution_type.replace('_', ' '),
        wallet.account_type ?? '',
      ].join(' ').toLowerCase().replace(/[-_]/g, ' ');
      const institutionMatches = filters.institution === 'all'
        || (filters.institution === 'bank' && (wallet.institution_type === 'bank' || wallet.institution_type === 'digital_bank'))
        || wallet.institution_type === filters.institution;
      const assetMatches = filters.asset === 'all'
        || (filters.asset === 'credit' && wallet.account_type === 'credit')
        || (filters.asset === 'liquid' && wallet.account_type !== 'credit');
      const accountMatches = filters.account === 'all' || wallet.account_type === filters.account;
      return (!query || searchable.includes(query)) && institutionMatches && assetMatches && accountMatches;
    });
  }, [filters, search, wallets]);
  const activeFilterCount = Object.values(filters).filter((value) => value !== 'all').length;

  useEffect(() => {
    try {
      window.localStorage.setItem('alalay-wallet-view', view);
    } catch {
      // Preference persistence is best effort when storage is unavailable.
    }
  }, [view]);

  useEffect(() => {
    if (!isFilterOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsFilterOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isFilterOpen]);
  return (
    <DashboardShell
      activeLabel="Wallets"
      title="Wallets"
      subtitle="Cash, accounts, transfers, and lending in one place"
      name={getName(session)}
      onSignOut={onSignOut}
    >
      {walletsQuery.isLoading ? (
        <>
          <PageSkeleton kind="budget" />
          <SlowLoadNotice show={walletsQuery.isSlowLoading} />
        </>
      ) : null}
      {walletsQuery.error ? (
        <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{walletsQuery.error}</p>
      ) : null}
      {!walletsQuery.isLoading ? (
        <>
          <section className="grid gap-4 xl:grid-cols-2">
            <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-dark via-brand-primary to-emerald-300 p-6 text-white shadow-sm">
              <p className="text-xs font-semibold tracking-[0.14em] text-white/75">
                LIQUID BALANCE
              </p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="font-mono text-4xl font-bold">
                  {isPrivate ? '••••••' : formatCurrency(liquidBalance, true)}
                </p>
                <button
                  type="button"
                  onClick={() => setIsPrivate((current) => !current)}
                  className="rounded-lg p-2 text-white/80 hover:bg-white/10"
                  aria-label={isPrivate ? 'Show wallet balances' : 'Hide wallet balances'}
                >
                  {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-6 text-white/85">
                Across {liquidWallets.length} wallet{liquidWallets.length === 1 ? '' : 's'}. Credit
                liabilities are shown separately.
              </p>
              <svg
                aria-hidden="true"
                viewBox="0 0 480 130"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full opacity-25"
              >
                <path
                  d="M0 106 C44 118, 76 68, 117 89 S177 114, 213 68 S283 38, 319 66 S378 92, 420 34 S454 42, 480 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M0 106 C44 118, 76 68, 117 89 S177 114, 213 68 S283 38, 319 66 S378 92, 420 34 S454 42, 480 20 L480 130 L0 130 Z"
                  fill="currentColor"
                  opacity="0.12"
                />
              </svg>
            </article>
            <LoansDebtCard
              data={loansQuery.data}
              onOpen={() => setIsLoansOpen(true)}
              isPrivate={isPrivate}
            />
          </section>
          <WalletQuickActions onAdd={() => setIsAddWalletOpen(true)} onTransfer={() => setIsTransferOpen(true)} onLoans={() => setIsLoansOpen(true)} />
          <section className="mt-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 lg:flex-nowrap">
              <h2 className="flex items-center gap-2 font-semibold">
                <WalletCards className="h-5 w-5 text-brand-primary" />
                Your wallets
              </h2>
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto lg:flex-nowrap">
                <SearchField value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search wallets..." aria-label="Search wallets" className="min-h-10 sm:max-w-[220px]" />
                <div className="relative">
                  <button type="button" onClick={() => setIsFilterOpen((current) => !current)} aria-expanded={isFilterOpen} aria-haspopup="dialog" className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-primary/40 ${activeFilterCount ? 'border-brand-primary bg-brand-soft text-brand-dark' : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Filter</span>{activeFilterCount ? <span aria-label={`${activeFilterCount} active filters`}>{activeFilterCount}</span> : null}
                  </button>
                  {isFilterOpen ? <WalletFilterPopover filters={filters} onChange={setFilters} onClear={() => setFilters(defaultWalletFilters)} /> : null}
                </div>
                <div className="inline-flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700" role="group" aria-label="Wallet view">
                  <button type="button" onClick={() => setView('grid')} aria-label="Grid view" aria-pressed={view === 'grid'} className={`grid h-9 w-9 place-items-center rounded-lg ${view === 'grid' ? 'bg-slate-100 text-brand-primary dark:bg-slate-800' : 'text-slate-400 hover:text-slate-700'}`}><Grid2X2 className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setView('list')} aria-label="List view" aria-pressed={view === 'list'} className={`grid h-9 w-9 place-items-center rounded-lg ${view === 'list' ? 'bg-slate-100 text-brand-primary dark:bg-slate-800' : 'text-slate-400 hover:text-slate-700'}`}><List className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
            {visibleWallets.length ? (
              view === 'grid' ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{visibleWallets.map((wallet) => <WalletCard key={wallet.id} wallet={wallet} isPrivate={isPrivate} />)}</div> : <WalletList wallets={visibleWallets} isPrivate={isPrivate} />
            ) : wallets.length ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                <p className="font-semibold text-slate-700 dark:text-slate-200">No wallets match your search.</p>
                <p className="mt-1">Try another search or clear your filters.</p>
                <button type="button" onClick={() => { setSearch(''); setFilters(defaultWalletFilters); }} className="mt-4 font-semibold text-brand-primary hover:text-brand-dark">Clear filters</button>
              </div>
            ) : null}
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-slate-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-white">Wallets are where your money or liability lives.</p>
              <p className="mt-1">Loans &amp; Debt track who owes whom. Keep them separate for clearer financial insights.</p>
            </div>
          </section>
        </>
      ) : null}
      <SlideOver
        open={isAddWalletOpen}
        onClose={() => setIsAddWalletOpen(false)}
        title="Add wallet"
        description="Add an account, cash wallet, or e-wallet to track."
      >
        <WalletForm onClose={() => setIsAddWalletOpen(false)} onSaved={walletsQuery.refetch} />
      </SlideOver>
      <SlideOver
        open={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        title="Transfer between wallets"
        description="Move money between your accounts. Fees are tracked separately."
      >
        <TransferForm
          wallets={liquidWallets}
          onSaved={walletsQuery.refetch}
          onClose={() => setIsTransferOpen(false)}
        />
      </SlideOver>
      <SlideOver
        open={isLoansOpen}
        onClose={() => setIsLoansOpen(false)}
        title="Loans & Debt"
        description="Your active lending and borrowing positions."
      >
        <div className="space-y-3">
          {loansQuery.data?.loans.length ? (
            loansQuery.data.loans.map((loan) => (
              <article
                key={loan.id}
                className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{loan.counterparty}</p>
                    <p className="mt-1 text-xs capitalize text-slate-500">
                      {loan.direction} · {loan.status.replace('_', ' ')}
                    </p>
                  </div>
                  <p className="font-mono font-bold">
                    {formatCurrency(loan.outstanding_principal, true)}
                  </p>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">
              No loans or debt to show yet.
            </p>
          )}
        </div>
      </SlideOver>
    </DashboardShell>
  );
}
