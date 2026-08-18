import { z } from "zod";
import { currencyAmount, safeDate } from "./common.schema.js";

export const incomeQuerySchema = z.object({
  type: z.string().trim().min(1).max(100).optional(),
  from: safeDate.optional(), to: safeDate.optional(),
}).strict().superRefine((value, ctx) => { if (value.from && value.to && value.from > value.to) ctx.addIssue({ code: "custom", path: ["to"], message: "to must not be before from." }); });

const incomeShape = z.object({
  source: z.string().trim().min(1).max(200),
  type: z.string().trim().min(1).max(100).optional(),
  custom_type: z.string().trim().max(100).nullable().optional(),
  amount: currencyAmount,
  date: safeDate,
  is_recurring: z.boolean().optional(),
  frequency: z.preprocess(
    (value) => (value === "" ? null : value),
    z.enum(["monthly", "weekly", "biweekly", "yearly"]).nullable().optional(),
  ),
  wallet_id: z.string().uuid(),
}).strict();

function checkRecurringFrequency(value: { is_recurring?: boolean; frequency?: string | null }, ctx: z.RefinementCtx) {
  if (value.is_recurring && !value.frequency) {
    ctx.addIssue({ code: "custom", path: ["frequency"], message: "Select how often this income repeats." });
  }
  if (!value.is_recurring && value.frequency) {
    ctx.addIssue({ code: "custom", path: ["frequency"], message: "Frequency only applies to recurring income." });
  }
}

export const createIncomeSchema = incomeShape.superRefine(checkRecurringFrequency);

export const updateIncomeSchema = incomeShape.partial().superRefine(checkRecurringFrequency);
