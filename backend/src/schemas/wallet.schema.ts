import { z } from 'zod';
import { currencyAmount, safeDate } from './common.schema.js';

export const walletInstitutionType = z.enum(['e_wallet', 'digital_bank', 'bank', 'cash', 'other']);
export const walletAccountType = z.enum(['debit', 'credit']);
export const walletAccountPurpose = z.enum(['everyday', 'savings']);
export const walletInterestFrequency = z.enum(['monthly', 'quarterly', 'semi_annually', 'annually', 'unspecified']);

const walletMetadata = {
  account_purpose: walletAccountPurpose.nullable().optional(),
  earns_interest: z.boolean().optional(),
  annual_interest_rate: z.coerce.number().min(0).max(100).nullable().optional(),
  interest_credit_frequency: walletInterestFrequency.nullable().optional(),
};

function validateWalletMetadata(value: {
  account_type?: 'debit' | 'credit' | null;
  account_purpose?: 'everyday' | 'savings' | null;
  earns_interest?: boolean;
  annual_interest_rate?: number | null;
  interest_credit_frequency?: string | null;
}, ctx: z.RefinementCtx) {
  const earnsInterest = value.earns_interest ?? false;
  if (value.account_type === 'credit' && value.account_purpose != null) {
    ctx.addIssue({ code: 'custom', path: ['account_purpose'], message: 'Credit accounts cannot have an account purpose.' });
  }
  if (value.account_type === 'credit' && (earnsInterest || value.annual_interest_rate != null || value.interest_credit_frequency != null)) {
    ctx.addIssue({ code: 'custom', path: ['earns_interest'], message: 'Savings interest settings are only available for debit savings accounts.' });
  }
  if (value.account_purpose === 'everyday' && earnsInterest) {
    ctx.addIssue({ code: 'custom', path: ['earns_interest'], message: 'Only savings accounts can earn interest.' });
  }
  if (value.account_purpose !== 'savings' && (value.annual_interest_rate != null || value.interest_credit_frequency != null)) {
    ctx.addIssue({ code: 'custom', path: ['annual_interest_rate'], message: 'Interest details require a savings account.' });
  }
  if (!earnsInterest && (value.annual_interest_rate != null || value.interest_credit_frequency != null)) {
    ctx.addIssue({ code: 'custom', path: ['annual_interest_rate'], message: 'Interest details require interest to be enabled.' });
  }
  if (earnsInterest && value.account_type !== 'debit') {
    ctx.addIssue({ code: 'custom', path: ['account_type'], message: 'Interest can only be enabled for debit savings accounts.' });
  }
  if (earnsInterest && value.account_purpose !== 'savings') {
    ctx.addIssue({ code: 'custom', path: ['account_purpose'], message: 'Interest can only be enabled for savings accounts.' });
  }
}

export const createWalletSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    institution_type: walletInstitutionType,
    institution_key: z.string().trim().min(1).max(100),
    account_type: walletAccountType.nullable().optional(),
    credit_limit: currencyAmount.nullable().optional(),
    ...walletMetadata,
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    icon: z.string().max(40).nullable().optional(),
  })
  .strict();

export const createWalletWithOpeningBalanceSchema = createWalletSchema
  .extend({
    opening_balance: currencyAmount,
  })
  .strict()
  .superRefine((value, ctx) => {
    validateWalletMetadata(value, ctx);
    if (
      value.account_type === 'credit' &&
      value.credit_limit != null &&
      value.opening_balance > value.credit_limit
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['opening_balance'],
        message: "Outstanding balance can't be greater than the credit limit.",
      });
    }
  });

export const updateWalletSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    icon: z.string().max(40).nullable().optional(),
    account_type: walletAccountType.nullable().optional(),
    credit_limit: currencyAmount.nullable().optional(),
    ...walletMetadata,
    default_outgoing_transfer_fee: currencyAmount.nullable().optional(),
  })
  .strict()
  .superRefine(validateWalletMetadata);

export const walletDepositSchema = z
  .object({
    amount: currencyAmount,
    date: safeDate,
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const walletTransferSchema = z
  .object({
    from_wallet_id: z.string().uuid(),
    to_wallet_id: z.string().uuid(),
    amount: currencyAmount.refine(
      (value) => value > 0,
      'Transfer amount must be greater than zero.',
    ),
    fee: currencyAmount.optional().default(0),
    transfer_method: z.enum(['instapay', 'pesonet', 'internal', 'other']).nullable().optional(),
    date: safeDate,
    note: z.string().trim().max(500).nullable().optional(),
    idempotency_key: z.string().trim().min(16).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.from_wallet_id === value.to_wallet_id)
      ctx.addIssue({
        code: 'custom',
        path: ['to_wallet_id'],
        message: 'Choose a different destination wallet.',
      });
  });

export const walletInterestSchema = z
  .object({
    amount: currencyAmount.refine(
      (value) => value > 0,
      'Interest amount must be greater than zero.',
    ),
    date: safeDate,
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const creditRepaymentSchema = z
  .object({
    payment_wallet_id: z.string().uuid(),
    principal_amount: currencyAmount.refine(
      (value) => value > 0,
      'Principal amount must be greater than zero.',
    ),
    interest_amount: currencyAmount.optional().default(0),
    fee_amount: currencyAmount.optional().default(0),
    payment_date: safeDate,
    idempotency_key: z.string().trim().min(16).max(100),
  })
  .strict();
