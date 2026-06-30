import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  avatar_url: z.string().url().nullable().optional(),
  currency: z.literal("PHP").optional(),
  language: z.enum(["en", "fil"]).optional(),
  plan: z.enum(["free", "plus", "family"]).optional(),
  income: z.coerce.number().nonnegative().optional(),
  pay_schedule: z.enum(["monthly", "semi-monthly", "weekly"]).optional(),
  onboarding_done: z.boolean().optional(),
});
