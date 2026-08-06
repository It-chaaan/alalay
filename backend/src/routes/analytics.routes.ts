import { Router } from "express";
import { budgetSummary, dashboardSummary, reportsSummary, saveBudget } from "../controllers/analytics.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { budgetSchema } from "../schemas/budget.schema.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

export const dashboardRouter = Router();
dashboardRouter.get("/summary", asyncHandler(dashboardSummary));

export const budgetRouter = Router();
budgetRouter.get("/summary", asyncHandler(budgetSummary));
budgetRouter.patch("/", writeRateLimit, validateRequest({ body: budgetSchema }), asyncHandler(saveBudget));

export const reportsRouter = Router();
reportsRouter.get("/summary", asyncHandler(reportsSummary));
