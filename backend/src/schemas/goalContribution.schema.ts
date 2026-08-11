import { z } from "zod";
import { currencyAmount } from "./common.schema.js";

export const goalContributionSchema = z.object({
  wallet_id: z.string().uuid(),
  amount: currencyAmount,
}).strict();
