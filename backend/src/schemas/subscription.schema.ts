import { z } from "zod";

export const createSubscriptionSchema = z.object({
  name: z.string().min(1),
  logo_url: z.string().url().nullable().optional(),
  amount: z.coerce.number().nonnegative(),
  renewal_date: z.string().date(),
  billing_cycle: z.enum(["monthly", "yearly"]).optional(),
  auto_renew: z.boolean().optional(),
  last_used_at: z.string().datetime().nullable().optional(),
});

export const updateSubscriptionSchema = createSubscriptionSchema.partial();
