import { Router } from "express";
import { z } from "zod";
import { addGoalContribution, makeResourceController, savingsDashboard } from "../controllers/resource.controller.js";
import type { TableName } from "../services/db.js";
import { idParamSchema } from "../schemas/common.schema.js";
import { createExpenseSchema, expenseQuerySchema, updateExpenseSchema } from "../schemas/expense.schema.js";
import { createIncomeSchema, incomeQuerySchema, updateIncomeSchema } from "../schemas/income.schema.js";
import { createSubscriptionSchema, updateSubscriptionSchema } from "../schemas/subscription.schema.js";
import { createSavingsGoalSchema, updateSavingsGoalSchema } from "../schemas/savingsGoal.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/api.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { processSubscriptionBilling } from "../services/subscription-billing.service.js";
import { listSubscriptionsWithOccurrences } from "../services/subscription-occurrence.service.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { goalContributionSchema } from "../schemas/goalContribution.schema.js";

export function resourceRouter(table: TableName) {
  const router = Router();
  const controller = makeResourceController(table);
  const billCreateSchema = createExpenseSchema.extend({ wallet_id: z.string().uuid() });
  const billUpdateSchema = billCreateSchema.partial();
  const schemaMap = {
    expenses: { query: expenseQuerySchema, create: createExpenseSchema, update: updateExpenseSchema },
    income: { query: incomeQuerySchema, create: createIncomeSchema, update: updateIncomeSchema },
    subscriptions: { query: undefined, create: createSubscriptionSchema, update: updateSubscriptionSchema },
    savings_goals: { query: undefined, create: createSavingsGoalSchema, update: updateSavingsGoalSchema },
    bills: { query: undefined, create: billCreateSchema, update: billUpdateSchema },
  } as const;
  const schemas = schemaMap[table];

  if (table === "savings_goals") {
    router.get("/summary", asyncHandler(savingsDashboard));
    router.post("/:id/contributions", writeRateLimit, validateRequest({ params: idParamSchema, body: goalContributionSchema }), asyncHandler(addGoalContribution));
  }

  router.get("/", validateRequest({ query: schemas.query }), asyncHandler(async (req, res, next) => {
    if (table === "expenses") await processSubscriptionBilling(req.user!.id);
    if (table === "subscriptions") {
      return sendSuccess(res, await listSubscriptionsWithOccurrences(req.user!.id));
    }
    return controller.list(req, res);
  }));
  router.get("/:id", validateRequest({ params: idParamSchema }), asyncHandler(controller.get));
  router.post("/", writeRateLimit, validateRequest({ body: schemas.create }), asyncHandler(controller.create));
  router.patch("/:id", writeRateLimit, validateRequest({ params: idParamSchema, body: schemas.update }), asyncHandler(controller.update));
  router.delete("/:id", writeRateLimit, validateRequest({ params: idParamSchema }), asyncHandler(controller.remove));

  return router;
}
