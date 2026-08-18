import { client, requireUserId, throwIfError, asNumber, todayIso } from './db.js';
import { AppError } from '../utils/api.js';
import { walletTransferPerspective } from './wallet-transactions.js';

export type WalletPayload = {
  name: string;
  institution_type: string;
  institution_key: string;
  account_type?: 'debit' | 'credit' | null;
  credit_limit?: number | null;
  color?: string;
  icon?: string | null;
};
export type WalletTransferPayload = {
  from_wallet_id: string;
  to_wallet_id: string;
  amount: number;
  fee: number;
  transfer_method?: 'instapay' | 'pesonet' | 'internal' | 'other' | null;
  date: string;
  note?: string | null;
  idempotency_key: string;
};

function validateAccountType(
  payload: Pick<WalletPayload, 'institution_type' | 'account_type' | 'credit_limit'>,
) {
  const supportsCardType =
    payload.institution_type === 'bank' || payload.institution_type === 'digital_bank';
  if (payload.account_type && !supportsCardType)
    throw new AppError(
      422,
      'unsupported_account_type',
      'This institution does not support Debit or Credit classification.',
    );
  if (payload.account_type !== 'credit' && payload.credit_limit != null)
    throw new AppError(
      422,
      'invalid_credit_limit',
      'Credit limit is only available for Credit accounts.',
    );
}

async function ensureCash(userId: string) {
  const ownerId = requireUserId(userId);
  const existing = await client()
    .from('wallets')
    .select('*')
    .eq('user_id', ownerId)
    .eq('is_default_cash', true)
    .maybeSingle();
  if (existing.data) return existing.data;
  const created = await client()
    .from('wallets')
    .insert({
      user_id: ownerId,
      name: 'Cash',
      institution_type: 'cash',
      institution_key: 'cash',
      color: '#0F8A6B',
      is_default_cash: true,
    })
    .select('*')
    .single();
  if (!created.error && created.data) return created.data;
  const retry = await client()
    .from('wallets')
    .select('*')
    .eq('user_id', ownerId)
    .eq('is_default_cash', true)
    .single();
  throwIfError(retry.error);
  return retry.data;
}

function withBalance(row: Record<string, unknown>) {
  return { ...row, balance: asNumber(row.balance) };
}

export async function listWallets(userId: string) {
  await ensureCash(userId);
  const { data, error } = await client()
    .from('wallets')
    .select('*')
    .eq('user_id', requireUserId(userId))
    .order('is_default_cash', { ascending: false })
    .order('created_at', { ascending: true });
  throwIfError(error);
  return (data ?? []).map(withBalance);
}

export async function getWallet(userId: string, id: string) {
  await ensureCash(userId);
  const ownerId = requireUserId(userId);
  const { data: wallet, error } = await client()
    .from('wallets')
    .select('*')
    .eq('user_id', ownerId)
    .eq('id', id)
    .single();
  if (error || !wallet) throw new AppError(404, 'not_found', 'Wallet not found.');
  const [income, expenses, bills, adjustments, transfers] = await Promise.all([
    client()
      .from('income')
      .select('id, source, amount, date, wallet_id')
      .eq('user_id', ownerId)
      .eq('wallet_id', id)
      .is('deleted_at', null)
      .limit(200),
    client()
      .from('expenses')
      .select('id, merchant, category, amount, date, wallet_id, source_bill_id')
      .eq('user_id', ownerId)
      .eq('wallet_id', id)
      .is('deleted_at', null)
      .limit(200),
    client()
      .from('bills')
      .select('id, title, category, amount, due_date, paid_at, status, wallet_id')
      .eq('user_id', ownerId)
      .eq('wallet_id', id)
      .eq('status', 'paid')
      .is('deleted_at', null)
      .limit(200),
    client()
      .from('wallet_adjustments')
      .select('id, amount, date, note, wallet_id')
      .eq('user_id', ownerId)
      .eq('wallet_id', id)
      .order('date', { ascending: false })
      .limit(200),
    client()
      .from('wallet_transfers')
      .select(
        'id, from_wallet_id, to_wallet_id, amount, fee, transfer_method, note, transferred_at, created_at',
      )
      .eq('user_id', ownerId)
      .or(`from_wallet_id.eq.${id},to_wallet_id.eq.${id}`)
      .order('transferred_at', { ascending: false })
      .limit(200),
  ]);
  const counterpartIds = (transfers.data ?? []).map((row) =>
    row.from_wallet_id === id ? row.to_wallet_id : row.from_wallet_id,
  );
  const counterpartResult = counterpartIds.length
    ? await client()
        .from('wallets')
        .select('id, name')
        .eq('user_id', ownerId)
        .in('id', counterpartIds)
    : { data: [], error: null };
  const counterpartNames = new Map((counterpartResult.data ?? []).map((row) => [row.id, row.name]));
  const transactionError = [
    income.error,
    expenses.error,
    bills.error,
    adjustments.error,
    transfers.error,
    counterpartResult.error,
  ].some(Boolean)
    ? 'Unable to load linked transactions.'
    : undefined;
  const transactions = [
    ...(income.data ?? []).map((row) => ({
      ...row,
      kind: 'income',
      label: row.source,
      date: row.date,
      amount: asNumber(row.amount),
    })),
    ...(expenses.data ?? []).map((row) => ({
      ...row,
      kind: 'expense',
      label: row.merchant,
      date: row.date,
      amount: -asNumber(row.amount),
    })),
    ...(bills.data ?? [])
      .filter(
        (bill) => !(expenses.data ?? []).some((expense) => expense.source_bill_id === bill.id),
      )
      .map((row) => ({
        ...row,
        kind: 'bill',
        label: row.title,
        date: row.paid_at ?? row.due_date,
        amount: -asNumber(row.amount),
      })),
    ...(adjustments.data ?? []).map((row) => ({
      ...row,
      kind: row.note === 'Opening balance' ? 'opening_balance' : 'deposit',
      label: row.note || 'Wallet deposit',
      date: row.date,
      amount: asNumber(row.amount),
    })),
    ...(transfers.data ?? []).map((row) => {
      const counterpartId = row.from_wallet_id === id ? row.to_wallet_id : row.from_wallet_id;
      const counterpartName = counterpartNames.get(counterpartId) ?? 'wallet';
      return walletTransferPerspective(row, id, counterpartName);
    }),
  ].sort((left, right) => String(right.date).localeCompare(String(left.date)));
  return {
    wallet: withBalance(wallet),
    transactions,
    ...(transactionError ? { transactionError } : {}),
  };
}

export async function createWalletTransfer(userId: string, payload: WalletTransferPayload) {
  requireUserId(userId);
  const { data, error } = await client().rpc('create_wallet_transfer', {
    source_wallet_id: payload.from_wallet_id,
    destination_wallet_id: payload.to_wallet_id,
    transfer_amount: payload.amount,
    transfer_fee: payload.fee,
    transfer_method_value: payload.transfer_method ?? null,
    transfer_note: payload.note ?? null,
    transfer_date: payload.date,
    request_key: payload.idempotency_key,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('enough available') ||
      message.includes('greater than zero') ||
      message.includes('different destination')
    ) {
      throw new AppError(422, 'transfer_invalid', error.message, undefined, true);
    }
    if (message.includes('no longer available'))
      throw new AppError(404, 'wallet_not_found', error.message, undefined, true);
    throwIfError(error);
  }
  return data;
}

export async function createWalletInterest(
  userId: string,
  walletId: string,
  payload: { amount: number; date: string; note?: string | null },
) {
  const ownerId = requireUserId(userId);
  const { data: wallet, error: walletError } = await client()
    .from('wallets')
    .select('id, name')
    .eq('id', walletId)
    .eq('user_id', ownerId)
    .single();
  if (walletError || !wallet) throw new AppError(404, 'not_found', 'Wallet not found.');
  const { data, error } = await client()
    .from('income')
    .insert({
      user_id: ownerId,
      wallet_id: walletId,
      source: payload.note?.trim() || `${wallet.name} interest`,
      type: 'interest',
      amount: payload.amount,
      date: payload.date,
      is_recurring: false,
    })
    .select('id, wallet_id, source, type, amount, date')
    .single();
  throwIfError(error);
  return data;
}

export async function createWallet(userId: string, payload: WalletPayload) {
  validateAccountType(payload);
  const { data, error } = await client()
    .from('wallets')
    .insert({
      ...payload,
      user_id: requireUserId(userId),
      color: payload.color ?? '#0F8A6B',
      is_default_cash: false,
    })
    .select('*')
    .single();
  throwIfError(error);
  return withBalance(data);
}

export async function createWalletWithOpeningBalance(
  userId: string,
  payload: WalletPayload & { opening_balance: number },
) {
  validateAccountType(payload);
  const ownerId = requireUserId(userId);
  const { data, error } = await client().rpc('create_wallet_with_opening_balance', {
    wallet_name: payload.name,
    wallet_type: payload.institution_type,
    wallet_key: payload.institution_key,
    wallet_color: payload.color ?? '#0F8A6B',
    wallet_icon: payload.icon ?? null,
    opening_amount: payload.opening_balance,
    account_type_value: payload.account_type ?? null,
    credit_limit_value: payload.credit_limit ?? null,
  });
  // The RPC is introduced by 20260811010000_wallet_opening_balance.sql. During
  // rolling deployments PostgREST can briefly have an older schema cache. Use
  // the same ledger tables as a compatibility path instead of creating a
  // wallet without its opening balance.
  if (error?.code === 'PGRST202') {
    const { data: wallet, error: walletError } = await client()
      .from('wallets')
      .insert({
        user_id: ownerId,
        name: payload.name,
        institution_type: payload.institution_type,
        institution_key: payload.institution_key,
        color: payload.color ?? '#0F8A6B',
        icon: payload.icon ?? null,
        is_default_cash: false,
        account_type: payload.account_type ?? null,
        credit_limit: payload.credit_limit ?? null,
      })
      .select('*')
      .single();
    throwIfError(walletError);

    if (payload.opening_balance > 0) {
      const { error: adjustmentError } = await client().from('wallet_adjustments').insert({
        user_id: ownerId,
        wallet_id: wallet.id,
        amount: payload.opening_balance,
        date: todayIso(),
        note: 'Opening balance',
      });
      if (adjustmentError) {
        const { error: rollbackError } = await client()
          .from('wallets')
          .delete()
          .eq('id', wallet.id)
          .eq('user_id', ownerId);
        if (rollbackError) {
          throw new AppError(
            500,
            'wallet_opening_balance_rollback_failed',
            'Wallet creation could not be completed safely.',
          );
        }
        throwIfError(adjustmentError);
      }
    }

    const { data: refreshed, error: refreshError } = await client()
      .from('wallets')
      .select('*')
      .eq('id', wallet.id)
      .eq('user_id', ownerId)
      .single();
    throwIfError(refreshError);
    return withBalance(refreshed);
  }
  throwIfError(error);
  return withBalance(data as Record<string, unknown>);
}

export async function createWalletDeposit(
  userId: string,
  walletId: string,
  payload: { amount: number; date: string; note?: string | null },
) {
  const ownerId = requireUserId(userId);
  const { data: wallet, error: walletError } = await client()
    .from('wallets')
    .select('id')
    .eq('id', walletId)
    .eq('user_id', ownerId)
    .single();
  if (walletError || !wallet) throw new AppError(404, 'not_found', 'Wallet not found.');
  const { data, error } = await client()
    .from('wallet_adjustments')
    .insert({
      user_id: ownerId,
      wallet_id: walletId,
      amount: payload.amount,
      date: payload.date,
      note: payload.note ?? null,
    })
    .select('id, wallet_id, amount, date, note')
    .single();
  throwIfError(error);
  return data;
}

export async function updateWallet(userId: string, id: string, payload: Record<string, unknown>) {
  const ownerId = requireUserId(userId);
  const { data: current, error: currentError } = await client()
    .from('wallets')
    .select('id, account_type, balance')
    .eq('user_id', ownerId)
    .eq('id', id)
    .single();
  if (currentError || !current) throw new AppError(404, 'not_found', 'Wallet not found.');

  if ('account_type' in payload && payload.account_type !== current.account_type) {
    throw new AppError(
      409,
      'wallet_classification_locked',
      'Debit or Credit classification cannot be changed after the wallet is created.',
    );
  }
  if (
    current.account_type === 'credit' &&
    payload.credit_limit != null &&
    Number(payload.credit_limit) < asNumber(current.balance)
  ) {
    throw new AppError(
      422,
      'credit_limit_below_outstanding',
      'Credit limit cannot be lower than the current outstanding balance.',
    );
  }

  const { data, error } = await client()
    .from('wallets')
    .update(payload)
    .eq('user_id', ownerId)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data)
    throw new AppError(404, 'not_found', 'Wallet not found or cannot be changed.');
  return withBalance(data);
}

export async function deleteWallet(userId: string, id: string) {
  requireUserId(userId);
  const { data, error } = await client().rpc('delete_wallet', { target_wallet_id: id });
  if (error || !data)
    throw new AppError(
      409,
      'wallet_delete_failed',
      error?.message ?? 'This wallet could not be removed.',
    );
  return { id: data };
}
