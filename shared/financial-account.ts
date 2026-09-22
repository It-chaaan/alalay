export type FinancialAccountType = 'cash' | 'bank' | 'digital_bank' | 'e_wallet' | 'credit';
export type BalancePocketType = 'available' | 'savings' | 'reserved';
export type CardNetwork = 'visa' | 'mastercard' | 'jcb' | 'unionpay' | 'amex' | 'other' | 'none';
export type CardInstrumentType = 'debit' | 'prepaid' | 'virtual_debit' | 'virtual_prepaid';
export type FinancialAccountStatus = 'active' | 'frozen' | 'closed';
export type PaymentInstructionStatus =
  'scheduled' | 'pending_confirmation' | 'completed' | 'failed' | 'cancelled' | 'reversed';

export type FinancialAccountSummary = {
  id: string;
  user_id: string;
  institution_type: string;
  institution_key: string;
  name: string;
  account_type: FinancialAccountType;
  currency: string;
  opening_balance: number | string;
  status: FinancialAccountStatus;
  include_in_total_balance: boolean;
  last_four?: string | null;
};

export function availableCredit(creditLimit: number | string, outstanding: number | string) {
  return Math.max(0, Number(creditLimit) - Number(outstanding));
}
