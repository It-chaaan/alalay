import { Router } from "express";
import { budgetSummary, dashboardSummary, reportsSummary, saveBudget } from "../controllers/analytics.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const dashboardRouter = Router();
dashboardRouter.get("/summary", asyncHandler(dashboardSummary));

export const budgetRouter = Router();
budgetRouter.get("/summary", asyncHandler(budgetSummary));
budgetRouter.patch("/", asyncHandler(saveBudget));

export const reportsRouter = Router();
reportsRouter.get("/summary", asyncHandler(reportsSummary));
