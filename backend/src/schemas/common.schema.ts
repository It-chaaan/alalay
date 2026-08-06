import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const nullableString = z.string().trim().min(1).nullable().optional();

export const currencyAmount = z.coerce.number().finite().min(0).max(100_000_000).multipleOf(0.01);

export const safeDate = z.string().date().refine((value) => {
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100;
}, "Date must be between 2000 and 2100.");
