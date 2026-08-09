import { z } from "zod";
import { currencyAmount, safeDate } from "./common.schema.js";

export const incomeQuerySchema = z.object({
  type: z.enum(["salary", "freelance", "business", "remittance", "other"]).optional(),
  from: safeDate.optional(), to: safeDate.optional(),
}).strict().superRefine((value, ctx) => { if (value.from && value.to && value.from > value.to) ctx.addIssue({ code: "custom", path: ["to"], message: "to must not be before from." }); });

export const createIncomeSchema = z.object({
  source: z.string().trim().min(1).max(200),
  type: z.enum(["salary", "freelance", "business", "remittance", "other"]).optional(),
  amount: currencyAmount,
  date: safeDate,
  is_recurring: z.boolean().optional(),
  frequency: z.enum(["monthly", "weekly", "biweekly", "yearly"]).nullable().optional(),
  wallet_id: z.string().uuid(),
}).strict();

export const updateIncomeSchema = createIncomeSchema.partial();
