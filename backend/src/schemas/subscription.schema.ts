import { z } from "zod";
import { currencyAmount, safeDate } from "./common.schema.js";

export const createSubscriptionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  logo_url: z.string().url().max(2_000).nullable().optional(),
  amount: currencyAmount,
  renewal_date: safeDate,
  billing_cycle: z.enum(["weekly", "monthly", "quarterly", "yearly"]).optional(),
  // Local reminder preference only; this app does not control provider renewal settings.
  auto_renew: z.boolean().optional(),
  // User-provided or internally derived local metadata, not provider usage telemetry.
  last_used_at: z.string().datetime().nullable().optional(),
  wallet_id: z.string().uuid().nullable().optional(),
}).strict();

export const updateSubscriptionSchema = createSubscriptionSchema.partial();
