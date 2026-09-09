import { client, requireUserId, throwIfError, asNumber, todayIso } from './db.js';
import { AppError } from '../utils/api.js';
import { walletTransferPerspective } from './wallet-transactions.js';
import { buildWalletOpeningBalanceRpcArgs } from './wallet-opening-balance.js';

export type WalletPayload = {
  name: string;
  institution_type: string;
  institution_key: string;
  currency?: string;
  last_four?: string | null;
  account_type?: 'debit' | 'credit' | null;
  credit_limit?: number | null;
  account_purpose?: 'everyday' | 'savings' | null;
  earns_interest?: boolean;
  annual_interest_rate?: number | null;
  interest_credit_frequency?:
    'monthly' | 'quarterly' | 'semi_annually' | 'annually' | 'unspecified' | null;
  payment_due_date?: string | null;
  payment_due_day?: number | null;
  payment_wallet_id?: string | null;
  auto_record_payment?: boolean;
  payment_rule?: 'full_outstanding' | 'fixed_amount' | 'minimum_due' | null;
  fixed_payment_amount?: number | null;
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
export type CreditRepaymentPayload = {
  payment_wallet_id: string;
  principal_amount: number;
  interest_amount: number;
  fee_amount: number;
  payment_date: string;
  idempotency_key: string;
};
export type CreditCardFinanceChargePayload = {
  statement_id: string;
  amount: number;
  date: string;
  charge_type: 'finance_charge' | 'late_fee';
  idempotency_key: string;
};
export type CreditCardStatementPayload = { period_start: string; period_end: string; closing_date: string; due_date: string; statement_balance: number; minimum_due: number; rate_used?: number | null; rate_basis_used?: 'annual' | 'monthly' | null; note?: string | null };

function validateAccountType(
  payload: Pick<
    WalletPayload,
    | 'institution_type'
    | 'account_type'
    | 'credit_limit'
    | 'account_purpose'
    | 'earns_interest'
    | 'annual_interest_rate'
    | 'interest_credit_frequency'
  >,
) {
  const supportsCardType =
    payload.institution_type === 'bank' || payload.institution_type === 'digital_bank';
  if (payload.account_type && !supportsCardType)
    throw new AppError(
      422,
      'wallet_classification_not_supported',
      'Debit or Credit classification is not available for the selected institution.',
    );
  if (payload.account_type !== 'credit' && payload.credit_limit != null)
    throw new AppError(
      422,
      'invalid_credit_limit',
      'Credit limit is only available for Credit accounts.',
    );
  if (payload.account_type === 'credit' && payload.account_purpose != null)
    throw new AppError(
      422,
      'invalid_account_purpose',
      'Credit accounts cannot have an account purpose.',
    );
  if (
    payload.account_type === 'credit' &&
    (payload.earns_interest ||
      payload.annual_interest_rate != null ||
      payload.interest_credit_frequency != null)
  )
    throw new AppError(
      422,
      'invalid_interest_metadata',
      'Savings interest settings are only available for debit savings accounts.',
    );
  if (
    payload.account_purpose !== 'savings' &&
    (payload.annual_interest_rate != null ||
      payload.interest_credit_frequency != null ||
      payload.earns_interest)
  )
    throw new AppError(
      422,
      'invalid_interest_metadata',
      'Interest settings require a savings account.',
    );
  if (payload.earns_interest && payload.account_type !== 'debit')
    throw new AppError(
      422,
      'invalid_interest_metadata',
      'Interest can only be enabled for debit savings accounts.',
    );
}

async function validateCreditPaymentWallet(
  userId: string,
  walletId: string | undefined,
  payload: Pick<
    WalletPayload,
    | 'account_type'
    | 'payment_due_date'
    | 'payment_due_day'
    | 'payment_wallet_id'
    | 'auto_record_payment'
    | 'payment_rule'
    | 'fixed_payment_amount'
  >,
  requireSetup: boolean,
) {
  if (payload.account_type !== 'credit') return;
  if (requireSetup && !payload.payment_due_date)
    throw new AppError(
      422,
      'payment_due_date_required',
      'Payment due date is required for Credit accounts.',
    );
  if (requireSetup && !payload.payment_wallet_id)
    throw new AppError(
      422,
      'payment_wallet_required',
      'Payment wallet is required for Credit accounts.',
    );
  if (payload.payment_wallet_id) {
    if (walletId && payload.payment_wallet_id === walletId)
      throw new AppError(422, 'invalid_payment_wallet', 'A credit card cannot pay itself.');
    const { data, error } = await client()
      .from('wallets')
      .select('id, account_type')
      .eq('id', payload.payment_wallet_id)
      .eq('user_id', requireUserId(userId))
      .maybeSingle();
    if (error || !data || data.account_type === 'credit')
      throw new AppError(
        422,
        'invalid_payment_wallet',
        'Choose an active non-credit payment wallet.',
      );
  }
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

function withBalance(row: Record<string, unknown>, reservedBalance = 0) {
  const totalBalance = asNumber(row.balance);
  const reservedForGoals = Math.max(0, asNumber(reservedBalance));
  return {
    ...row,
    balance: totalBalance,
    total_balance: totalBalance,
    reserved_for_goals: reservedForGoals,
    available_balance: totalBalance - reservedForGoals,
  };
}

async function withReservedBalances(userId: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return [];
  const ids = rows.map((row) => String(row.id));
  const { data, error } = await client()
    .from('wallet_reserved_balances')
    .select('wallet_id, reserved_balance')
    .eq('user_id', requireUserId(userId))
    .in('wallet_id', ids);
  throwIfError(error);
  const reservedByWallet = new Map((data ?? []).map((row) => [String(row.wallet_id), asNumber(row.reserved_balance)]));
  return rows.map((row) => withBalance(row, reservedByWallet.get(String(row.id))));
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
  return withReservedBalances(userId, data ?? []);
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
  const [
    income,
    expenses,
    bills,
    adjustments,
    transfers,
    loans,
    loanPayments,
    creditRepayments,
    cardStatements,
    cardFinanceCharges,
    goalContributions,
    goalReleases,
  ] = await Promise.all([
    client()
      .from('income')
      .select('id, source, amount, date, wallet_id')
      .eq('user_id', ownerId)
      .eq('wallet_id', id)
      .eq('is_posted', true)
      .is('deleted_at', null)
      .limit(200),
    client()
      .from('expenses')
      .select(
        'id, merchant, category, amount, date, wallet_id, source_bill_id, credit_repayment_id',
      )
      .eq('user_id', ownerId)
      .eq('wallet_id', id)
      .is('deleted_at', null)
      .limit(200),
    client()
      .from('bills')
      .select('id, title, category, amount, due_date, paid_at, status, wallet_id, credit_wallet_id')
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
    client()
      .from('loans')
      .select('id, counterparty, direction, original_principal, start_date, wallet_id')
      .eq('user_id', ownerId)
      .eq('wallet_id', id)
      .limit(200),
    client()
      .from('loan_payments')
      .select(
        'id, loan_id, principal_amount, interest_amount, paid_on, note, interest_income_id, interest_expense_id, loans(counterparty, direction)',
      )
      .eq('user_id', ownerId)
      .eq('wallet_id', id)
      .order('paid_on', { ascending: false })
      .limit(200),
    client()
      .from('credit_repayments')
      .select(
        'id, credit_wallet_id, payment_wallet_id, principal_amount, interest_amount, fee_amount, payment_date, source_bill_id, interest_expense_id, fee_expense_id',
      )
      .eq('user_id', ownerId)
      .or(`credit_wallet_id.eq.${id},payment_wallet_id.eq.${id}`)
      .order('payment_date', { ascending: false })
      .limit(200),
    wallet.account_type === 'credit'
      ? client().from('credit_card_statements').select('*').eq('user_id', ownerId).eq('credit_wallet_id', id).order('closing_date', { ascending: false }).limit(24)
      : Promise.resolve({ data: [], error: null }),
    wallet.account_type === 'credit'
      ? client().from('credit_card_finance_charges').select('*').eq('user_id', ownerId).eq('credit_wallet_id', id).order('charged_on', { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    client()
      .from('goal_contributions')
      .select('id, amount, contribution_date, created_at, savings_goals(title)')
      .eq('user_id', ownerId)
      .eq('wallet_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
    client()
      .from('goal_contribution_releases')
      .select('id, amount, released_on, created_at, contribution_id, goal_contributions(wallet_id, savings_goals(title))')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);
  const counterpartIds = [
    ...(transfers.data ?? []).map((row) =>
      row.from_wallet_id === id ? row.to_wallet_id : row.from_wallet_id,
    ),
    ...(creditRepayments.data ?? []).map((row) =>
      row.credit_wallet_id === id ? row.payment_wallet_id : row.credit_wallet_id,
    ),
  ];
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
    loans.error,
    loanPayments.error,
    creditRepayments.error,
    cardStatements.error,
    cardFinanceCharges.error,
    goalContributions.error,
    goalReleases.error,
    counterpartResult.error,
  ].some(Boolean)
    ? 'Unable to load linked transactions.'
    : undefined;
  const linkedInterestIncomeIds = new Set(
    (loanPayments.data ?? []).map((payment) => payment.interest_income_id).filter(Boolean),
  );
  const linkedInterestExpenseIds = new Set(
    (loanPayments.data ?? []).map((payment) => payment.interest_expense_id).filter(Boolean),
  );
  const linkedCreditExpenseIds = new Set(
    (creditRepayments.data ?? [])
      .flatMap((repayment) => [repayment.interest_expense_id, repayment.fee_expense_id])
      .filter(Boolean),
  );
  const transactions = [
    ...(income.data ?? [])
      .filter((row) => !linkedInterestIncomeIds.has(row.id))
      .map((row) => ({
        ...row,
        kind: 'income',
        label: row.source,
        date: row.date,
        amount: asNumber(row.amount),
      })),
    ...(expenses.data ?? [])
      .filter((row) => !linkedInterestExpenseIds.has(row.id) && !linkedCreditExpenseIds.has(row.id))
      .map((row) => ({
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
    ...(goalContributions.data ?? []).map((row) => {
      const goal = Array.isArray(row.savings_goals) ? row.savings_goals[0] : row.savings_goals;
      return {
        ...row,
        kind: 'goal_allocation',
        label: `Reserved for ${goal?.title ?? 'Savings goal'}`,
        date: row.contribution_date ?? row.created_at,
        amount: -asNumber(row.amount),
      };
    }),
    ...(goalReleases.data ?? [])
      .filter((row) => {
        const contribution = Array.isArray(row.goal_contributions)
          ? row.goal_contributions[0]
          : row.goal_contributions;
        return contribution?.wallet_id === id;
      })
      .map((row) => {
        const contribution = Array.isArray(row.goal_contributions)
          ? row.goal_contributions[0]
          : row.goal_contributions;
        const goal = Array.isArray(contribution?.savings_goals)
          ? contribution.savings_goals[0]
          : contribution?.savings_goals;
        return {
          ...row,
          kind: 'goal_release',
          label: `Released from goal: ${goal?.title ?? 'Savings goal'}`,
          date: row.released_on ?? row.created_at,
          amount: asNumber(row.amount),
        };
      }),
    ...(transfers.data ?? []).map((row) => {
      const counterpartId = row.from_wallet_id === id ? row.to_wallet_id : row.from_wallet_id;
      const counterpartName = counterpartNames.get(counterpartId) ?? 'wallet';
      return walletTransferPerspective(row, id, counterpartName);
    }),
    ...(loans.data ?? []).map((loan) => {
      const isLent = loan.direction === 'lent';
      return {
        ...loan,
        kind: isLent ? 'loan_lent' : 'loan_borrowed',
        label: isLent ? `Lent to ${loan.counterparty}` : `Borrowed from ${loan.counterparty}`,
        date: loan.start_date,
        amount: isLent ? -asNumber(loan.original_principal) : asNumber(loan.original_principal),
      };
    }),
    ...(loanPayments.data ?? []).map((payment) => {
      const loan = Array.isArray(payment.loans) ? payment.loans[0] : payment.loans;
      const isLent = loan?.direction === 'lent';
      const total = asNumber(payment.principal_amount) + asNumber(payment.interest_amount);
      return {
        ...payment,
        kind: isLent ? 'loan_repayment_received' : 'debt_repayment',
        label: isLent
          ? `Repayment from ${loan?.counterparty ?? 'borrower'}`
          : `Repayment to ${loan?.counterparty ?? 'lender'}`,
        date: payment.paid_on,
        amount: isLent ? total : -total,
        detail:
          payment.interest_amount && asNumber(payment.interest_amount) > 0
            ? `₱${asNumber(payment.principal_amount).toLocaleString('en-PH')} principal · ₱${asNumber(payment.interest_amount).toLocaleString('en-PH')} interest`
            : 'Principal repayment',
      };
    }),
    ...(creditRepayments.data ?? []).map((repayment) => {
      const isCreditWallet = repayment.credit_wallet_id === id;
      const counterpartName =
        counterpartNames.get(
          isCreditWallet ? repayment.payment_wallet_id : repayment.credit_wallet_id,
        ) ?? 'credit account';
      const total =
        asNumber(repayment.principal_amount) +
        asNumber(repayment.interest_amount) +
        asNumber(repayment.fee_amount);
      return {
        ...repayment,
        kind: isCreditWallet ? 'credit_repayment' : 'credit_repayment_funded',
        label: isCreditWallet
          ? `Repayment from ${counterpartName}`
          : `Credit repayment to ${counterpartName}`,
        date: repayment.payment_date,
        amount: isCreditWallet ? -asNumber(repayment.principal_amount) : -total,
        detail: `${asNumber(repayment.principal_amount).toLocaleString('en-PH')} principal`,
      };
    }),
  ].sort((left, right) => String(right.date).localeCompare(String(left.date)));
  const [walletWithBalances] = await withReservedBalances(userId, [wallet]);
  const interestEstimate = wallet.earns_interest
    ? await getWalletInterestEstimate(userId, id)
    : { enabled: false, tracking_mode: 'estimate_only' };
  const creditCardInterestEstimate = wallet.account_type === 'credit'
    ? await getCreditCardInterestEstimate(userId, id)
    : { enabled: false, tracking_mode: 'estimate_only' };
  return {
    wallet: walletWithBalances,
    transactions,
    interestEstimate,
    creditCardInterestEstimate,
    statements: cardStatements.data ?? [],
    financeCharges: cardFinanceCharges.data ?? [],
    ...(transactionError ? { transactionError } : {}),
  };
}

export async function repayCreditAccount(
  userId: string,
  creditWalletId: string,
  payload: CreditRepaymentPayload,
) {
  requireUserId(userId);
  const { data, error } = await client().rpc('repay_credit_account', {
    target_credit_wallet_id: creditWalletId,
    selected_payment_wallet_id: payload.payment_wallet_id,
    principal_value: payload.principal_amount,
    interest_value: payload.interest_amount,
    fee_value: payload.fee_amount,
    selected_payment_date: payload.payment_date,
    request_key: payload.idempotency_key,
    source_bill_id_value: null,
    source_bill_occurrence_date_value: null,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('not enough available') || message.includes('exceeds outstanding')) {
      throw new AppError(422, 'repayment_invalid', error.message, undefined, true);
    }
    if (
      message.includes('credit wallet not found') ||
      message.includes('payment wallet is not available')
    ) {
      throw new AppError(404, 'wallet_not_found', error.message, undefined, true);
    }
    throwIfError(error);
  }
  return data;
}

export async function createWalletTransfer(userId: string, payload: WalletTransferPayload) {
  const ownerId = requireUserId(userId);
  const { data: destination, error: destinationError } = await client()
    .from('wallets')
    .select('id, account_type')
    .eq('id', payload.to_wallet_id)
    .eq('user_id', ownerId)
    .maybeSingle();
  if (destinationError || !destination) {
    throw new AppError(404, 'wallet_not_found', 'One of these wallets is no longer available.');
  }
  if (destination.account_type === 'credit') {
    // A payment into a credit account settles liability; it is not a normal
    // deposit and must not create an asset-side transfer-in balance.
    return repayCreditAccount(ownerId, payload.to_wallet_id, {
      payment_wallet_id: payload.from_wallet_id,
      principal_amount: payload.amount,
      interest_amount: 0,
      fee_amount: payload.fee,
      payment_date: payload.date,
      idempotency_key: payload.idempotency_key,
    });
  }
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
  payload: { amount: number; date: string; note?: string | null; idempotency_key: string },
) {
  const ownerId = requireUserId(userId);
  const { data, error } = await client().rpc('post_wallet_interest', {
    target_wallet_id: walletId, received_amount: payload.amount, credited_on_value: payload.date,
    note_value: payload.note ?? null, request_key: payload.idempotency_key,
  });
  if (error?.message.includes('Wallet not found')) throw new AppError(404, 'not_found', 'Wallet not found.');
  throwIfError(error);
  return data;
}

export async function getWalletInterestEstimate(userId: string, walletId: string) {
  requireUserId(userId);
  const { data, error } = await client().rpc('wallet_interest_estimate', { target_wallet_id: walletId });
  if (error?.message.includes('Wallet not found')) throw new AppError(404, 'not_found', 'Wallet not found.');
  throwIfError(error);
  return data;
}

export async function getCreditCardInterestEstimate(userId: string, walletId: string) {
  requireUserId(userId);
  const { data, error } = await client().rpc('credit_card_interest_estimate', { target_wallet_id: walletId });
  if (error?.message.includes('Credit card not found')) throw new AppError(404, 'not_found', 'Credit card not found.');
  throwIfError(error);
  return data;
}

export async function createCreditCardFinanceCharge(userId: string, walletId: string, payload: CreditCardFinanceChargePayload) {
  requireUserId(userId);
  const { data, error } = await client().rpc('record_credit_card_finance_charge', {
    target_credit_wallet_id: walletId,
    statement_id_value: payload.statement_id,
    charge_amount: payload.amount,
    charged_on_value: payload.date,
    charge_type_value: payload.charge_type,
    request_key: payload.idempotency_key,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('estimate-only') || message.includes('statement not found') || message.includes('positive currency'))
      throw new AppError(422, 'credit_card_charge_invalid', error.message, undefined, true);
    if (message.includes('credit card not found')) throw new AppError(404, 'not_found', 'Credit card not found.');
    throwIfError(error);
  }
  return data;
}

export async function createCreditCardStatement(userId: string, walletId: string, payload: CreditCardStatementPayload) {
  requireUserId(userId);
  const { data, error } = await client().rpc('create_credit_card_statement', {
    target_credit_wallet_id: walletId, period_start_value: payload.period_start, period_end_value: payload.period_end,
    closing_date_value: payload.closing_date, due_date_value: payload.due_date,
    statement_balance_value: payload.statement_balance, minimum_due_value: payload.minimum_due,
    rate_used_value: payload.rate_used ?? null, rate_basis_used_value: payload.rate_basis_used ?? null,
    note_value: payload.note ?? null,
  });
  if (error?.message.includes('Credit card not found')) throw new AppError(404, 'not_found', 'Credit card not found.');
  if (error?.code === '23505' || error?.message.includes('Invalid statement')) throw new AppError(422, 'credit_card_statement_invalid', error.message, undefined, true);
  throwIfError(error);
  return data;
}

export async function createWallet(userId: string, payload: WalletPayload) {
  validateAccountType(payload);
  await validateCreditPaymentWallet(userId, undefined, payload, payload.account_type === 'credit');
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

async function createCreditWalletWithOpeningBalance(
  userId: string,
  payload: WalletPayload & { opening_balance: number },
) {
  const ownerId = requireUserId(userId);
  const { data: wallet, error: walletError } = await client()
    .from('wallets')
    .insert({
      user_id: ownerId,
      name: payload.name,
      institution_type: payload.institution_type,
      institution_key: payload.institution_key,
      currency: payload.currency ?? 'PHP',
      last_four: payload.last_four ?? null,
      color: payload.color ?? '#0F8A6B',
      icon: payload.icon ?? null,
      is_default_cash: false,
      account_type: 'credit',
      credit_limit: payload.credit_limit ?? null,
    })
    .select('*')
    .single();
  throwIfError(walletError);
  if (!wallet)
    throw new AppError(500, 'wallet_creation_failed', 'The credit card could not be created.');

  if (payload.opening_balance > 0) {
    const { error: adjustmentError } = await client().from('wallet_adjustments').insert({
      user_id: ownerId,
      wallet_id: wallet.id,
      amount: payload.opening_balance,
      date: todayIso(),
      note: 'Opening outstanding balance',
    });
    if (adjustmentError) {
      await client().from('wallets').delete().eq('id', wallet.id).eq('user_id', ownerId);
      throwIfError(adjustmentError);
    }
  }

  const { data: configuredWallet, error: configurationError } = await client()
    .from('wallets')
    .update({
      payment_due_date: payload.payment_due_date ?? null,
      payment_due_day: payload.payment_due_day ?? null,
      payment_wallet_id: payload.payment_wallet_id ?? null,
      auto_record_payment: payload.auto_record_payment ?? false,
      payment_rule: payload.payment_rule ?? null,
      fixed_payment_amount: payload.fixed_payment_amount ?? null,
    })
    .eq('id', wallet.id)
    .eq('user_id', ownerId)
    .select('*')
    .single();
  if (configurationError) {
    await client().from('wallets').delete().eq('id', wallet.id).eq('user_id', ownerId);
    throwIfError(configurationError);
  }
  return withBalance(configuredWallet as Record<string, unknown>);
}

export async function createWalletWithOpeningBalance(
  userId: string,
  payload: WalletPayload & { opening_balance: number },
) {
  validateAccountType(payload);
  await validateCreditPaymentWallet(userId, undefined, payload, payload.account_type === 'credit');
  const { data, error } = await client().rpc(
    'create_wallet_with_opening_balance_v2',
    buildWalletOpeningBalanceRpcArgs(payload),
  );
  if (error?.code === 'P0001' && error.message.includes('classification')) {
    throw new AppError(
      422,
      'wallet_classification_not_supported',
      'Debit or Credit classification is not available for the selected institution.',
      `${error.code}: ${error.message}`,
    );
  }
  if (error && error.code !== 'PGRST202' && error.code !== 'PGRST203') throwIfError(error);
  // Never fall back to separate wallet and ledger writes: the RPC is the
  // atomic financial boundary. An older schema cache must fail safely until
  // the forward migration is deployed and PostgREST has refreshed its cache.
  if (error?.code === 'PGRST202' || error?.code === 'PGRST203') {
    throw new AppError(
      503,
      'wallet_opening_balance_unavailable',
      'Wallet creation is temporarily unavailable while the database is updating. Please try again shortly.',
      'create_wallet_with_opening_balance_v2 RPC is unavailable in the PostgREST schema cache.',
    );
  }
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
    .select(
      'id, institution_type, account_type, balance, account_purpose, earns_interest, annual_interest_rate, interest_credit_frequency, payment_due_date, payment_due_day, payment_wallet_id, auto_record_payment, payment_rule, fixed_payment_amount',
    )
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

  validateAccountType({
    institution_type: ('institution_type' in payload
      ? payload.institution_type
      : current.institution_type) as string,
    account_type: ('account_type' in payload
      ? payload.account_type
      : current.account_type) as WalletPayload['account_type'],
    credit_limit: payload.credit_limit as number | null | undefined,
    account_purpose: ('account_purpose' in payload
      ? payload.account_purpose
      : current.account_purpose) as WalletPayload['account_purpose'],
    earns_interest: ('earns_interest' in payload
      ? payload.earns_interest
      : current.earns_interest) as boolean | undefined,
    annual_interest_rate: ('annual_interest_rate' in payload
      ? payload.annual_interest_rate
      : current.annual_interest_rate) as number | null | undefined,
    interest_credit_frequency: ('interest_credit_frequency' in payload
      ? payload.interest_credit_frequency
      : current.interest_credit_frequency) as WalletPayload['interest_credit_frequency'],
  });
  await validateCreditPaymentWallet(
    userId,
    id,
    {
      account_type: ('account_type' in payload
        ? payload.account_type
        : current.account_type) as WalletPayload['account_type'],
      payment_due_date: ('payment_due_date' in payload
        ? payload.payment_due_date
        : current.payment_due_date) as string | null | undefined,
      payment_due_day: ('payment_due_day' in payload
        ? payload.payment_due_day
        : current.payment_due_day) as number | null | undefined,
      payment_wallet_id: ('payment_wallet_id' in payload
        ? payload.payment_wallet_id
        : current.payment_wallet_id) as string | null | undefined,
      auto_record_payment: ('auto_record_payment' in payload
        ? payload.auto_record_payment
        : current.auto_record_payment) as boolean | undefined,
      payment_rule: ('payment_rule' in payload
        ? payload.payment_rule
        : current.payment_rule) as WalletPayload['payment_rule'],
      fixed_payment_amount: ('fixed_payment_amount' in payload
        ? payload.fixed_payment_amount
        : current.fixed_payment_amount) as number | null | undefined,
    },
    false,
  );

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
