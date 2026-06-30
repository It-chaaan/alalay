import { z } from "zod";

export const expenseQuerySchema = z.object({
  category: z.string().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const createExpenseSchema = z.object({
  amount: z.coerce.number().nonnegative(),
  category: z.string().min(1),
  merchant: z.string().min(1),
  date: z.string().date(),
  payment_method: z.enum(["cash", "card", "gcash", "maya", "bank_transfer", "other"]).optional(),
  receipt_url: z.string().url().nullable().optional(),
  ocr_raw: z.record(z.string(), z.unknown()).nullable().optional(),
  is_split: z.boolean().optional(),
  split_with: z.array(z.string().uuid()).optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();
