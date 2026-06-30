import { z } from "zod";

export const createSavingsGoalSchema = z.object({
  title: z.string().min(1),
  emoji: z.string().optional(),
  target_amount: z.coerce.number().nonnegative(),
  current_amount: z.coerce.number().nonnegative().optional(),
  deadline: z.string().date(),
  completed_at: z.string().datetime().nullable().optional(),
});

export const updateSavingsGoalSchema = createSavingsGoalSchema.partial();
