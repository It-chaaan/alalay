import { z } from 'zod';
import { currencyAmount, safeDate } from './common.schema.js';

export const walletInstitutionType = z.enum(['e_wallet', 'digital_bank', 'bank', 'cash', 'other']);
export const walletAccountType = z.enum(['debit', 'credit']);
export const walletAccountPurpose = z.enum(['everyday', 'savings']);
export const walletInterestFrequency = z.enum([
  'monthly',
  'quarterly',
  'semi_annually',
  'annually',
  'unspecified',
]);
const walletCurrency = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, 'Currency must be a three-letter ISO code.')
  .default('PHP');
const walletLastFour = z
  .string()
  .regex(/^\d{4}$/, 'Last four digits must contain exactly four numbers.')
  .nullable()
  .optional();

const walletMetadata = {
  account_purpose: walletAccountPurpose.nullable().optional(),
  earns_interest: z.boolean().optional(),
  annual_interest_rate: z.coerce.number().min(0).max(100).nullable().optional(),
  interest_credit_frequency: walletInterestFrequency.nullable().optional(),
  statement_date: safeDate.nullable().optional(),
  statement_day: z.coerce.number().int().min(1).max(31).nullable().optional(),
  payment_due_date: safeDate.nullable().optional(),
  payment_due_day: z.coerce.number().int().min(1).max(31).nullable().optional(),
  payment_wallet_id: z.string().uuid().nullable().optional(),
  auto_record_payment: z.boolean().optional(),
  payment_rule: z.enum(['full_outstanding', 'fixed_amount', 'minimum_due']).nullable().optional(),
  fixed_payment_amount: currencyAmount.nullable().optional(),
};

function validateWalletMetadata(
  value: {
    account_type?: 'debit' | 'credit' | null;
    account_purpose?: 'everyday' | 'savings' | null;
    earns_interest?: boolean;
    annual_interest_rate?: number | null;
    interest_credit_frequency?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  const earnsInterest = value.earns_interest ?? false;
  if (value.account_type === 'credit' && value.account_purpose != null) {
    ctx.addIssue({
      code: 'custom',
      path: ['account_purpose'],
      message: 'Credit accounts cannot have an account purpose.',
    });
  }
  if (
    value.account_type === 'credit' &&
    (earnsInterest || value.annual_interest_rate != null || value.interest_credit_frequency != null)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['earns_interest'],
      message: 'Savings interest settings are only available for debit savings accounts.',
    });
  }
  if (value.account_purpose === 'everyday' && earnsInterest) {
    ctx.addIssue({
      code: 'custom',
      path: ['earns_interest'],
      message: 'Only savings accounts can earn interest.',
    });
  }
  if (
    value.account_purpose !== 'savings' &&
    (value.annual_interest_rate != null || value.interest_credit_frequency != null)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['annual_interest_rate'],
      message: 'Interest details require a savings account.',
    });
  }
  if (
    !earnsInterest &&
    (value.annual_interest_rate != null || value.interest_credit_frequency != null)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['annual_interest_rate'],
      message: 'Interest details require interest to be enabled.',
    });
  }
  if (earnsInterest && value.account_type !== 'debit') {
    ctx.addIssue({
      code: 'custom',
      path: ['account_type'],
      message: 'Interest can only be enabled for debit savings accounts.',
    });
  }
  if (earnsInterest && value.account_purpose !== 'savings') {
    ctx.addIssue({
      code: 'custom',
      path: ['account_purpose'],
      message: 'Interest can only be enabled for savings accounts.',
    });
  }
}

function validateCreditPaymentMetadata(
  value: {
    account_type?: 'debit' | 'credit' | null;
    statement_date?: string | null;
    payment_due_date?: string | null;
    payment_wallet_id?: string | null;
    auto_record_payment?: boolean;
    payment_rule?: 'full_outstanding' | 'fixed_amount' | 'minimum_due' | null;
    fixed_payment_amount?: number | null;
  },
  ctx: z.RefinementCtx,
  requireSetup = false,
) {
  const hasSettings =
    value.statement_date != null ||
    value.payment_due_date != null ||
    value.payment_wallet_id != null ||
    value.auto_record_payment === true ||
    value.payment_rule != null ||
    value.fixed_payment_amount != null;
  if (value.account_type !== 'credit') {
    if (hasSettings)
      ctx.addIssue({
        code: 'custom',
        path: ['payment_due_date'],
        message: 'Credit payment settings are only available for Credit accounts.',
      });
    return;
  }
  if (requireSetup && !value.payment_due_date)
    ctx.addIssue({
      code: 'custom',
      path: ['payment_due_date'],
      message: 'Payment due date is required for Credit accounts.',
    });
  if (requireSetup && !value.payment_wallet_id)
    ctx.addIssue({
      code: 'custom',
      path: ['payment_wallet_id'],
      message: 'Payment wallet is required for Credit accounts.',
    });
  if (requireSetup && !value.statement_date)
    ctx.addIssue({
      code: 'custom',
      path: ['statement_date'],
      message: 'Statement date is required for Credit accounts.',
    });
  if (
    value.statement_date &&
    value.payment_due_date &&
    value.payment_due_date <= value.statement_date
  )
    ctx.addIssue({
      code: 'custom',
      path: ['payment_due_date'],
      message: 'Payment due date must be after the statement date.',
    });
  if (
    value.payment_rule === 'fixed_amount' &&
    !(value.fixed_payment_amount && value.fixed_payment_amount > 0)
  )
    ctx.addIssue({
      code: 'custom',
      path: ['fixed_payment_amount'],
      message: 'Enter a fixed payment amount greater than zero.',
    });
  if (value.fixed_payment_amount != null && value.payment_rule !== 'fixed_amount')
    ctx.addIssue({
      code: 'custom',
      path: ['payment_rule'],
      message: 'Fixed payment amount requires the fixed amount rule.',
    });
  if (
    value.auto_record_payment &&
    (!value.payment_due_date || !value.payment_wallet_id || !value.payment_rule)
  )
    ctx.addIssue({
      code: 'custom',
      path: ['auto_record_payment'],
      message: 'Automatic payment tracking requires a due date, payment wallet, and payment rule.',
    });
}

export const createWalletSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    institution_type: walletInstitutionType,
    institution_key: z.string().trim().min(1).max(100),
    currency: walletCurrency,
    last_four: walletLastFour,
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
    validateCreditPaymentMetadata(value, ctx, true);
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
    institution_type: walletInstitutionType.optional(),
    currency: walletCurrency.optional(),
    last_four: walletLastFour,
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
  .superRefine((value, ctx) => {
    validateWalletMetadata(value, ctx);
    validateCreditPaymentMetadata(value, ctx);
  });

export const walletDepositSchema = z
  .object({
    amount: currencyAmount,
    date: safeDate,
    note: z.string().trim().max(500).nullable().optional(),
    idempotency_key: z.string().trim().min(8).max(200),
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
    idempotency_key: z.string().trim().min(8).max(200),
  })
  .strict();

export const creditCardFinanceChargeSchema = z
  .object({
    statement_id: z.string().uuid(),
    amount: currencyAmount.refine((value) => value > 0, 'Charge amount must be greater than zero.'),
    date: safeDate,
    charge_type: z.enum(['finance_charge', 'late_fee']).default('finance_charge'),
    idempotency_key: z.string().trim().min(16).max(100),
  })
  .strict();

export const creditCardStatementSchema = z
  .object({
    period_start: safeDate,
    period_end: safeDate,
    closing_date: safeDate,
    due_date: safeDate,
    statement_balance: currencyAmount,
    minimum_due: currencyAmount,
    rate_used: z.coerce.number().min(0).max(100).nullable().optional(),
    rate_basis_used: z.enum(['annual', 'monthly']).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.period_start > value.period_end)
      ctx.addIssue({
        code: 'custom',
        path: ['period_end'],
        message: 'Period end must be on or after period start.',
      });
    if (value.closing_date < value.period_end)
      ctx.addIssue({
        code: 'custom',
        path: ['closing_date'],
        message: 'Closing date must be on or after period end.',
      });
    if (value.due_date <= value.closing_date)
      ctx.addIssue({
        code: 'custom',
        path: ['due_date'],
        message: 'Due date must be after closing date.',
      });
    if (value.minimum_due > value.statement_balance)
      ctx.addIssue({
        code: 'custom',
        path: ['minimum_due'],
        message: 'Minimum due cannot exceed statement balance.',
      });
  });

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
