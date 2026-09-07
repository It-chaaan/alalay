import type { WalletPayload } from './wallets.service.js';

export function buildWalletOpeningBalanceRpcArgs(
  payload: WalletPayload & { opening_balance: number },
) {
  return {
    wallet_name: payload.name,
    wallet_type: payload.institution_type,
    wallet_key: payload.institution_key,
    wallet_color: payload.color ?? '#0F8A6B',
    wallet_icon: payload.icon ?? null,
    opening_amount: payload.opening_balance,
    account_type_value: payload.account_type ?? null,
    credit_limit_value: payload.credit_limit ?? null,
    account_purpose_value: payload.account_purpose ?? null,
    earns_interest_value: payload.earns_interest ?? false,
    annual_interest_rate_value: payload.annual_interest_rate ?? null,
    interest_credit_frequency_value: payload.interest_credit_frequency ?? null,
    wallet_currency: payload.currency ?? 'PHP',
    wallet_last_four: payload.last_four ?? null,
    payment_due_date_value: payload.payment_due_date ?? null,
    payment_wallet_id_value: payload.payment_wallet_id ?? null,
    auto_record_payment_value: payload.auto_record_payment ?? false,
    payment_rule_value: payload.payment_rule ?? null,
    fixed_payment_amount_value: payload.fixed_payment_amount ?? null,
  };
}
