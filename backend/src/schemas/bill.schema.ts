import { z } from "zod";
import { currencyAmount, safeDate } from "./common.schema.js";

export const billQuerySchema = z.object({
  status: z.enum(["unpaid", "paid", "overdue"]).optional(),
  due_within_days: z.coerce.number().int().nonnegative().max(365).optional(),
  category: z.string().trim().max(100).optional(),
}).strict();

const billShape = z.object({
  title: z.string().trim().min(1).max(200),
  amount: currencyAmount,
  category: z.string().trim().min(1).max(100),
  due_date: safeDate,
  recurring: z.boolean().optional(),
  frequency: z.enum(["monthly", "weekly", "yearly", "quarterly"]).nullable().optional(),
  status: z.enum(["unpaid", "paid", "overdue"]).optional(),
  notes: z.string().max(2_000).nullable().optional(),
  attachment_url: z.string().url().max(2_000).nullable().optional(),
  wallet_id: z.string().uuid().nullable().optional(),
}).strict();

function checkRecurringFrequency(
  value: { recurring?: boolean; frequency?: string | null },
  ctx: z.RefinementCtx
) {
  if (value.recurring && !value.frequency) {
    ctx.addIssue({ code: "custom", path: ["frequency"], message: "frequency is required for recurring bills." });
  }
  if (!value.recurring && value.frequency) {
    ctx.addIssue({ code: "custom", path: ["frequency"], message: "frequency requires recurring=true." });
  }
}

export const createBillSchema = billShape.superRefine(checkRecurringFrequency);

export const updateBillSchema = billShape.partial().superRefine((value, ctx) => {
  if (value.recurring === undefined && value.frequency === undefined) return;
  checkRecurringFrequency(value, ctx);
});

export const billPaymentSchema = z.object({
  wallet_id: z.string().uuid(),
  payment_date: safeDate,
}).strict();
