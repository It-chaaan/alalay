import { z } from 'zod';
import { currencyAmount } from './common.schema.js';

export const goalContributionSchema = z
  .object({
    wallet_id: z.string().uuid(),
    amount: currencyAmount,
    contribution_date: z.string().date(),
    note: z.string().trim().max(500).optional(),
    idempotency_key: z.string().trim().min(8).max(200),
  })
  .strict();

export const goalReleaseSchema = z
  .object({
    contribution_id: z.string().uuid(),
    amount: currencyAmount,
    release_date: z.string().date().optional(),
    note: z.string().trim().max(500).optional(),
    idempotency_key: z.string().trim().min(8).max(200),
  })
  .strict();
