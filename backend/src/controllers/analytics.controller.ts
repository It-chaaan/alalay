import type { Request, Response } from "express";
import { getBudgetSummary, getDashboardSummary, getReports } from "../services/analytics.service.js";
import { sendSuccess } from "../utils/api.js";

export async function dashboardSummary(req: Request, res: Response) {
  return sendSuccess(res, await getDashboardSummary(req.user!.id));
}

export async function budgetSummary(req: Request, res: Response) {
  return sendSuccess(res, await getBudgetSummary(req.user!.id));
}

export async function reportsSummary(req: Request, res: Response) {
  return sendSuccess(res, await getReports(req.user!.id));
}
