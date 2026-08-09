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
  const body = req.validated?.body as {
    month?: string;
    categories: Array<{
      id: string;
      name: string;
      budget: number;
      auto_distribute?: boolean;
      last_distributed_month?: string | null;
      last_distributed_amount?: number;
    }>;
    auto_distribute_savings?: boolean;
    remaining_savings_behavior?: "save" | "carry_over" | "none";
  };
  const categories = body.categories;
  const autoDistributeSavings = Boolean(body.auto_distribute_savings);
  const remainingSavingsBehavior = body.remaining_savings_behavior;

  return sendSuccess(res, await saveBudgetPlan(req.user!.id, categories, { month: body.month, autoDistributeSavings, remainingSavingsBehavior }));
}

export async function reportsSummary(req: Request, res: Response) {
  const period = typeof req.query.period === "string" ? req.query.period : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  return sendSuccess(res, await getReports(req.user!.id, { period, from, to }));
}
