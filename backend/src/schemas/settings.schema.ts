import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
  phone: z.string().max(32).nullable().optional(),
  currency: z.enum(["PHP", "USD", "EUR", "JPY", "SGD"]).optional(),
  language: z.enum(["en", "fil"]).optional(),
  income: z.coerce.number().finite().nonnegative().max(100_000_000).optional(),
  pay_schedule: z.enum(["monthly", "semi-monthly", "weekly"]).optional(),
  onboarding_done: z.boolean().optional(),
}).strict();

export const notificationPreferencesSchema = z.object({
  bill_reminders: z.boolean(),
  bill_reminder_days: z.coerce.number().int().min(0).max(30),
  subscription_reminders: z.boolean(),
  summaries: z.boolean(),
  overspending_alerts: z.boolean(),
  budget_thresholds: z.boolean(),
  savings_milestones: z.boolean(),
  login_alerts: z.boolean(),
}).strict();

export const overviewCardKeySchema = z.enum(["bills", "spending", "savings", "budget"]);

export const overviewPreferencesSchema = z.object({
  cards: z.array(overviewCardKeySchema).min(1).max(4),
}).strict();
