import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronRight,
  HandCoins,
  Plus,
  Send,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { institutionFor, institutionRegistry } from '@shared/institution-registry';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { SlideOver } from '../../components/ui/SlideOver';
import { PageSkeleton, SlowLoadNotice } from '../../components/ui/Skeleton';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useApiQuery } from '../../hooks/useApiQuery';
import type { LoanSummary, Wallet } from '../../hooks/types';
import { formatCurrency } from '../../utils/formatters';

type Loan = {
  id: string;
  counterparty: string;
  direction: 'lent' | 'borrowed';
  outstanding_principal: number;
  status: 'active' | 'paid' | 'written_off';
};
type LoansResponse = { loans: Loan[]; summary: LoanSummary };
type WalletFormProps = { onClose: () => void; onSaved: () => void };

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

function WalletCard({ wallet }: { wallet: Wallet }) {
  const isCredit = wallet.account_type === 'credit';
  const label = wallet.account_type
    ? `${wallet.account_type} · PHP`
    : `${wallet.institution_type.replace('_', ' ')} · PHP`;
  return (
    <article className="min-h-48 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-primary/35 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <InstitutionMark wallet={wallet} />
        <ChevronRight className="mt-1 h-5 w-5 text-slate-400" aria-hidden="true" />
      </div>
      <div className="mt-4">
        <h3 className="truncate font-semibold text-slate-950 dark:text-white">{wallet.name}</h3>
        <p className="mt-1 text-xs capitalize text-slate-500">{label}</p>
      </div>
      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">
          {isCredit ? 'Outstanding' : 'Balance'}
        </p>
        <p className="mt-1 font-mono text-xl font-bold text-slate-950 dark:text-white">
          {formatCurrency(Number(wallet.balance), true)}
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
          className="min-h-11 rounded-full bg-brand-primary px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? 'Saving…' : 'Save wallet'}
        </button>
      </div>
    </form>
  );
}

function TransferForm({ wallets, onSaved }: { wallets: Wallet[]; onSaved: () => void }) {
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
  }
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6"
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
      <div className="mt-5 flex items-center justify-between gap-3">
        {error ? <p className="text-sm text-red-600">{error}</p> : <span />}
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

function LoansDebtCard({ data, onOpen }: { data: LoansResponse | null; onOpen: () => void }) {
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
            {formatCurrency(data?.summary.owed_to_me ?? 0, true)}
          </p>
        </div>
        <div className="rounded-2xl bg-rose-50 p-4 dark:bg-rose-950/30">
          <HandCoins className="h-5 w-5 text-rose-600" />
          <p className="mt-4 text-sm text-slate-500">I owe</p>
          <p className="mt-1 font-mono text-lg font-bold">
            {formatCurrency(data?.summary.i_owe ?? 0, true)}
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
  const [isLoansOpen, setIsLoansOpen] = useState(false);
  const wallets = walletsQuery.data ?? [];
  const liquidWallets = wallets.filter((wallet) => wallet.account_type !== 'credit');
  const liquidBalance = useMemo(
    () => liquidWallets.reduce((total, wallet) => total + Number(wallet.balance), 0),
    [liquidWallets],
  );
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
          <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
            <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark via-brand-primary to-[#48b994] p-7 text-white shadow-sm">
              <p className="text-xs font-semibold tracking-[0.14em] text-white/75">
                LIQUID BALANCE
              </p>
              <p className="mt-5 font-mono text-4xl font-bold">
                {formatCurrency(liquidBalance, true)}
              </p>
              <p className="mt-4 max-w-sm text-sm leading-6 text-white/85">
                Across {liquidWallets.length} wallet{liquidWallets.length === 1 ? '' : 's'}. Credit
                liabilities are shown separately.
              </p>
              <span
                className="pointer-events-none absolute -bottom-12 right-8 h-40 w-40 rounded-full border-2 border-white/25"
                aria-hidden="true"
              />
            </article>
            <LoansDebtCard data={loansQuery.data} onOpen={() => setIsLoansOpen(true)} />
          </section>
          <section className="mt-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <WalletCards className="h-5 w-5 text-brand-primary" />
                Your wallets
              </h2>
              <button
                type="button"
                onClick={() => setIsAddWalletOpen(true)}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-primary px-4 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Add wallet
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {wallets.map((wallet) => (
                <WalletCard key={wallet.id} wallet={wallet} />
              ))}
            </div>
          </section>
          <section className="mt-7">
            <TransferForm wallets={liquidWallets} onSaved={walletsQuery.refetch} />
          </section>
        </>
      ) : null}
      <SlideOver
        open={isAddWalletOpen}
        onClose={() => setIsAddWalletOpen(false)}
        title="Add wallet"
        description="Choose the institution and account details you want to track."
      >
        <WalletForm onClose={() => setIsAddWalletOpen(false)} onSaved={walletsQuery.refetch} />
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
