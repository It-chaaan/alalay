import { z } from "zod";
import { currencyAmount, safeDate } from "./common.schema.js";

export const expenseQuerySchema = z.object({
  category: z.string().trim().max(100).optional(),
  from: safeDate.optional(),
  to: safeDate.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) ctx.addIssue({ code: "custom", path: ["to"], message: "to must not be before from." });
});

const ocrRawSchema = z.object({
  confidence: z.coerce.number().min(0).max(100).optional(),
  cashier: z.string().max(200).optional(),
  items: z.array(z.object({
    id: z.string().max(100), name: z.string().trim().min(1).max(200), quantity: z.coerce.number().int().positive().max(10_000),
    unit_price: currencyAmount, total: currencyAmount,
  }).strict()).max(500).optional(),
  notes: z.string().max(2_000).optional(),
  receipt_date: safeDate.optional(), expense_date: safeDate.optional(),
  source: z.string().max(255).optional(),
  raw_text: z.string().max(50_000).optional(),
}).strict();

export const createExpenseSchema = z.object({
  amount: currencyAmount,
  category: z.string().trim().min(1).max(100),
  custom_category: z.string().trim().max(100).nullable().optional(),
  categories: z.array(z.string().trim().min(1).max(100)).min(1).max(20).optional(),
  merchant: z.string().trim().min(1).max(200),
  date: safeDate,
  payment_method: z.enum(["cash", "card", "gcash", "maya", "bank_transfer", "other"]).optional(),
  receipt_url: z.string().url().max(2_000).nullable().optional(),
  ocr_raw: ocrRawSchema.nullable().optional(),
  is_split: z.boolean().optional(),
  split_with: z.array(z.string().uuid()).optional(),
  subscription_id: z.string().uuid().nullable().optional(),
  billing_cycle: z.enum(["weekly", "monthly", "quarterly", "yearly"]).nullable().optional(),
  occurrence_date: z.string().date().nullable().optional(),
  generated_by: z.literal("subscription").nullable().optional(),
  recurrence_key: z.string().max(200).nullable().optional(),
  billing_status: z.enum(["generated", "paid", "void"]).nullable().optional(),
  generated_at: z.string().datetime().nullable().optional(),
  wallet_id: z.string().uuid(),
}).strict();

export const updateExpenseSchema = createExpenseSchema.partial();
