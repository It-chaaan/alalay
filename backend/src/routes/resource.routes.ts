import { Router } from "express";
import { makeResourceController } from "../controllers/resource.controller.js";
import type { TableName } from "../services/db.js";
import { idParamSchema } from "../schemas/common.schema.js";
import { createExpenseSchema, expenseQuerySchema, updateExpenseSchema } from "../schemas/expense.schema.js";
import { createIncomeSchema, incomeQuerySchema, updateIncomeSchema } from "../schemas/income.schema.js";
import { createSubscriptionSchema, updateSubscriptionSchema } from "../schemas/subscription.schema.js";
import { createSavingsGoalSchema, updateSavingsGoalSchema } from "../schemas/savingsGoal.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";

export function resourceRouter(table: TableName) {
  const router = Router();
  const controller = makeResourceController(table);
  const schemaMap = {
    expenses: { query: expenseQuerySchema, create: createExpenseSchema, update: updateExpenseSchema },
    income: { query: incomeQuerySchema, create: createIncomeSchema, update: updateIncomeSchema },
    subscriptions: { query: undefined, create: createSubscriptionSchema, update: updateSubscriptionSchema },
    savings_goals: { query: undefined, create: createSavingsGoalSchema, update: updateSavingsGoalSchema },
    bills: { query: undefined, create: createExpenseSchema, update: updateExpenseSchema },
  } as const;
  const schemas = schemaMap[table];

  router.get("/", validateRequest({ query: schemas.query }), asyncHandler(controller.list));
  router.get("/:id", validateRequest({ params: idParamSchema }), asyncHandler(controller.get));
  router.post("/", validateRequest({ body: schemas.create }), asyncHandler(controller.create));
  router.patch("/:id", validateRequest({ params: idParamSchema, body: schemas.update }), asyncHandler(controller.update));
  router.delete("/:id", validateRequest({ params: idParamSchema }), asyncHandler(controller.remove));

  return router;
}
