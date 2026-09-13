import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(32).nullable().optional(),
  currency: z.enum(["PHP", "USD", "EUR", "JPY", "SGD"]).optional(),
  language: z.enum(["en", "fil"]).optional(),
  income: z.coerce.number().finite().nonnegative().max(100_000_000).optional(),
  pay_schedule: z.enum(["monthly", "semi-monthly", "weekly"]).optional(),
  onboarding_done: z.boolean().optional(),
}).strict();

export const updateAvatarSchema = z.object({
  avatar_path: z.string().min(1).max(300).nullable(),
}).strict();

export const completeOnboardingSchema = z.object({
  nickname: z.string().trim().min(1, 'Enter the name you want Alalay to use.').max(80, 'Nickname is too long.'),
  wallet_name: z.string().trim().min(1, 'Enter a wallet name.').max(120),
  opening_balance: z.coerce.number().finite().min(0, 'Cash balance cannot be negative.').multipleOf(0.01),
  operation_id: z.string().uuid(),
}).strict();

const notificationPreferenceFields = z.object({
  bill_reminders: z.boolean(),
  bill_reminder_days: z.coerce.number().int().min(0).max(30),
  bill_reminder_three_days: z.boolean().optional().default(true),
  bill_reminder_one_day: z.boolean().optional().default(true),
  bill_reminder_due_day: z.boolean().optional().default(true),
  bill_overdue_reminders: z.boolean().optional().default(true),
  bill_reminder_hour: z.coerce.number().int().min(0).max(23).optional().default(9),
  bill_reminder_minute: z.coerce.number().int().min(0).max(59).optional().default(0),
  subscription_reminders: z.boolean(),
  subscription_reminder_three_days: z.boolean().optional().default(true),
  subscription_reminder_one_day: z.boolean().optional().default(true),
  subscription_reminder_due_day: z.boolean().optional().default(true),
  subscription_overdue_reminders: z.boolean().optional().default(true),
  summaries: z.boolean(),
  overspending_alerts: z.boolean(),
  budget_thresholds: z.boolean(),
  savings_milestones: z.boolean(),
  login_alerts: z.boolean(),
}).strict();

export const notificationPreferencesSchema = notificationPreferenceFields.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Choose at least one notification preference to update.',
);

export const overviewCardKeySchema = z.enum(["bills", "spending", "savings", "budget"]);

export const overviewPreferencesSchema = z.object({
  cards: z.array(overviewCardKeySchema).min(1).max(4),
}).strict();
