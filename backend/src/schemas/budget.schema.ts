import { z } from "zod";

const budgetCategorySchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  budget: z.coerce.number().finite().nonnegative().max(100_000_000),
  auto_distribute: z.boolean().optional(),
  last_distributed_month: z.string().date().nullable().optional(),
  last_distributed_amount: z.coerce.number().finite().nonnegative().max(100_000_000).optional(),
}).strict();

export const budgetSchema = z.object({
  categories: z.array(budgetCategorySchema).max(100),
  auto_distribute_savings: z.boolean().optional(),
  remaining_savings_behavior: z.enum(["auto_general", "leave_unallocated", "ask_monthly"]).optional(),
}).strict();
