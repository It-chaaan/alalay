import { z } from "zod";
import { currencyAmount, safeDate } from "./common.schema.js";

const savingsGoalShape = z.object({
  title: z.string().trim().min(1).max(200),
  emoji: z.string().max(16).optional(),
  target_amount: currencyAmount,
  current_amount: currencyAmount.optional(),
  monthly_target: currencyAmount.optional(),
  funding_method: z.enum(["manual", "monthly"]).optional(),
  monthly_contribution: currencyAmount.optional(),
  preferred_wallet_id: z.string().uuid().nullable().optional(),
  deadline: safeDate,
  completed_at: z.string().datetime().nullable().optional(),
}).strict();

function checkCurrentWithinTarget(
  value: { current_amount?: number; target_amount?: number },
  ctx: z.RefinementCtx
) {
  if (
    value.current_amount !== undefined &&
    value.target_amount !== undefined &&
    value.current_amount > value.target_amount
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["current_amount"],
      message: "current_amount cannot exceed target_amount.",
    });
  }
}

export const createSavingsGoalSchema = savingsGoalShape.superRefine(checkCurrentWithinTarget);

export const updateSavingsGoalSchema = savingsGoalShape.partial().superRefine((value, ctx) => {
  // A target may be reduced below the amount already saved; that represents a reached goal.
  // The saved amount is never reduced by a target edit.
  if (value.current_amount !== undefined && value.target_amount !== undefined) checkCurrentWithinTarget(value, ctx);
});
