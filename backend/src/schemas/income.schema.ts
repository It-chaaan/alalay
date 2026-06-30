import { z } from "zod";

export const incomeQuerySchema = z.object({
  type: z.enum(["salary", "freelance", "business", "remittance", "other"]).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const createIncomeSchema = z.object({
  source: z.string().min(1),
  type: z.enum(["salary", "freelance", "business", "remittance", "other"]).optional(),
  amount: z.coerce.number().nonnegative(),
  date: z.string().date(),
  is_recurring: z.boolean().optional(),
});

export const updateIncomeSchema = createIncomeSchema.partial();
