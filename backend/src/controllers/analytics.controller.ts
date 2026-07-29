import type { Request, Response } from "express";
import { getBudgetSummary, getDashboardSummary, getReports, saveBudgetPlan } from "../services/analytics.service.js";
import { sendSuccess } from "../utils/api.js";

export async function dashboardSummary(req: Request, res: Response) {
  return sendSuccess(res, await getDashboardSummary(req.user!.id));
}

export async function budgetSummary(req: Request, res: Response) {
  const month = typeof req.query.month === "string" ? req.query.month : undefined;

  return sendSuccess(res, await getBudgetSummary(req.user!.id, { month }));
}

export async function saveBudget(req: Request, res: Response) {
  const categories = Array.isArray(req.body?.categories) ? req.body.categories : [];
  const autoDistributeSavings = Boolean(req.body?.auto_distribute_savings);
  const remainingSavingsBehavior = typeof req.body?.remaining_savings_behavior === "string" ? req.body.remaining_savings_behavior : undefined;

  return sendSuccess(res, await saveBudgetPlan(req.user!.id, categories, { autoDistributeSavings, remainingSavingsBehavior }));
}

export async function reportsSummary(req: Request, res: Response) {
  const period = typeof req.query.period === "string" ? req.query.period : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  return sendSuccess(res, await getReports(req.user!.id, { period, from, to }));
}
