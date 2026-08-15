import { z } from 'zod';
import { currencyAmount, safeDate } from './common.schema.js';

export const walletInstitutionType = z.enum(['e_wallet', 'digital_bank', 'bank', 'cash', 'other']);
export const walletAccountType = z.enum(['debit', 'credit']);

export const createWalletSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    institution_type: walletInstitutionType,
    institution_key: z.string().trim().min(1).max(100),
    account_type: walletAccountType.nullable().optional(),
    credit_limit: currencyAmount.nullable().optional(),
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
    default_outgoing_transfer_fee: currencyAmount.nullable().optional(),
    interest_rate: z.coerce.number().min(0).max(1000).nullable().optional(),
    interest_crediting_frequency: z
      .enum(['monthly', 'quarterly', 'yearly', 'other'])
      .nullable()
      .optional(),
  })
  .strict();

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
