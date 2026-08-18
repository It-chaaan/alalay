import { Router } from "express";
import { incomeForMonth, incomeForRange } from "../services/financial-summary.service.js";
import { addDaysIso, todayIso } from "../services/db.js";
import { sendSuccess } from "../utils/api.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { resourceRouter } from "./resource.routes.js";
import { nextPayday } from "../services/payday.service.js";

export const incomeRouter = Router();

incomeRouter.get("/summary", asyncHandler(async (req, res) => {
  const month = typeof req.query.month === "string" ? req.query.month : undefined;
  const summary = await incomeForMonth(req.user!.id, month);
  return sendSuccess(res, {
    this_month: summary.this_month,
    ytd: summary.ytd,
    average_month: summary.average_month,
    sources: summary.sources,
    monthly_sources: new Set(summary.rows.filter((row) => Boolean(row.is_recurring) && String(row.frequency ?? "").toLowerCase() === "monthly").map((row) => row.source)).size,
    actual_transactions: summary.actualRows.length,
  });
}));

incomeRouter.get("/occurrences", asyncHandler(async (req, res) => {
  const from = typeof req.query.from === "string" ? req.query.from : addDaysIso(-90);
  const to = typeof req.query.to === "string" ? req.query.to : todayIso();
  const summary = await incomeForRange(req.user!.id, from, to);
  return sendSuccess(res, summary.rows);
}));

incomeRouter.get("/next-payday", asyncHandler(async (req, res) => {
  return sendSuccess(res, await nextPayday(req.user!.id));
}));

incomeRouter.use("/", resourceRouter("income"));
