import { z } from 'zod';
import { currencyAmount, safeDate } from './common.schema.js';

export const incomeQuerySchema = z
  .object({
    type: z.string().trim().min(1).max(100).optional(),
    from: safeDate.optional(),
    to: safeDate.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.from && value.to && value.from > value.to)
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'to must not be before from.' });
  });

// Keep the list endpoint independent from the refined full query schema. Zod v4
// cannot derive an object with pick() after refinements have been attached.
export const incomeRecordedQuerySchema = z
  .object({
    from: safeDate.optional(),
    to: safeDate.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'to must not be before from.' });
    }
  });

export const incomeMonthQuerySchema = z
  .object({
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM.')
      .optional(),
  })
  .strict();

export const skipIncomeOccurrenceParamsSchema = z
  .object({
    sourceId: z.string().uuid(),
    date: safeDate,
  })
  .strict();

const incomeShape = z
  .object({
    source: z.string().trim().min(1).max(200),
    type: z.string().trim().min(1).max(100).optional(),
    custom_type: z.string().trim().max(100).nullable().optional(),
    amount: currencyAmount,
    date: safeDate,
    is_recurring: z.boolean().optional(),
    frequency: z.preprocess(
      (value) => (value === '' ? null : value),
      z.enum(['monthly', 'weekly', 'biweekly', 'yearly']).nullable().optional(),
    ),
    wallet_id: z.string().uuid(),
    idempotency_key: z.string().trim().min(16).max(100).optional(),
  })
  .strict();

function checkRecurringFrequency(
  value: { is_recurring?: boolean; frequency?: string | null },
  ctx: z.RefinementCtx,
) {
  if (value.is_recurring && !value.frequency) {
    ctx.addIssue({
      code: 'custom',
      path: ['frequency'],
      message: 'Select how often this income repeats.',
    });
  }
  if (!value.is_recurring && value.frequency) {
    ctx.addIssue({
      code: 'custom',
      path: ['frequency'],
      message: 'Frequency only applies to recurring income.',
    });
  }
}

export const createIncomeSchema = incomeShape.superRefine(checkRecurringFrequency);

export const updateIncomeSchema = incomeShape.partial().superRefine(checkRecurringFrequency);
