import { Router } from "express";
import { incomeForMonth } from "../services/financial-summary.service.js";
import { sendSuccess } from "../utils/api.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { resourceRouter } from "./resource.routes.js";

export const incomeRouter = Router();

incomeRouter.get("/summary", asyncHandler(async (req, res) => {
  const month = typeof req.query.month === "string" ? req.query.month : undefined;
  const summary = await incomeForMonth(req.user!.id, month);
  return sendSuccess(res, {
    this_month: summary.this_month,
    ytd: summary.ytd,
    average_month: summary.average_month,
    sources: summary.sources,
    monthly_sources: new Set(summary.rows.filter((row) => Boolean(row.is_recurring) && String(row.frequency ?? "monthly").toLowerCase() === "monthly").map((row) => row.source)).size,
    actual_transactions: summary.actualRows.length,
  });
}));

incomeRouter.use("/", resourceRouter("income"));
