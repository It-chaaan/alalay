import { z } from "zod";

export const billQuerySchema = z.object({
  status: z.enum(["unpaid", "paid", "overdue"]).optional(),
  due_within_days: z.coerce.number().int().nonnegative().max(365).optional(),
  category: z.string().optional(),
});

export const createBillSchema = z.object({
  title: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  category: z.string().min(1),
  due_date: z.string().date(),
  recurring: z.boolean().optional(),
  frequency: z.enum(["monthly", "weekly", "yearly", "quarterly"]).nullable().optional(),
  status: z.enum(["unpaid", "paid", "overdue"]).optional(),
  notes: z.string().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
});

export const updateBillSchema = createBillSchema.partial();
