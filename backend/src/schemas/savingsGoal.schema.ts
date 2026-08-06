import { z } from "zod";
import { currencyAmount, safeDate } from "./common.schema.js";

const savingsGoalShape = z.object({
  title: z.string().trim().min(1).max(200),
  emoji: z.string().max(16).optional(),
  target_amount: currencyAmount,
  current_amount: currencyAmount.optional(),
  monthly_target: currencyAmount.optional(),
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
  // Only enforce when the patch touches at least one of the two fields.
  if (value.current_amount === undefined && value.target_amount === undefined) return;
  checkCurrentWithinTarget(value, ctx);
});