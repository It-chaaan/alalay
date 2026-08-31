import { Router } from 'express';
import {
  incomeForMonth,
  incomeForRange,
  myIncomeForMonth,
} from '../services/financial-summary.service.js';
import { addDaysIso, todayIso } from '../services/db.js';
import { sendSuccess } from '../utils/api.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { resourceRouter } from './resource.routes.js';
import { nextPayday } from '../services/payday.service.js';
import { incomeMonthQuerySchema, incomeRecordedQuerySchema } from '../schemas/income.schema.js';
import { validateRequest } from '../middleware/validateRequest.js';

export const incomeRouter = Router();

/** Posted transactions only; schedule definitions and future projections stay out of Recent Income. */
incomeRouter.get(
  '/recorded',
  validateRequest({ query: incomeRecordedQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.validated?.query as { from?: string; to?: string } | undefined;
    const from = query?.from ?? `${todayIso().slice(0, 7)}-01`;
    const to = query?.to ?? todayIso();
    const summary = await incomeForRange(req.user!.id, from, to);
    return sendSuccess(res, summary.actualRows);
  }),
);

incomeRouter.get(
  '/my-income',
  validateRequest({ query: incomeMonthQuerySchema }),
  asyncHandler(async (req, res) => {
    const month = (req.validated?.query as { month?: string } | undefined)?.month;
    return sendSuccess(res, await myIncomeForMonth(req.user!.id, month));
  }),
);

incomeRouter.get(
  '/upcoming',
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : todayIso();
    const to = typeof req.query.to === 'string' ? req.query.to : addDaysIso(400);
    const summary = await incomeForRange(req.user!.id, from, to);
    return sendSuccess(
      res,
      summary.scheduledRows.filter((row) => row.is_scheduled),
    );
  }),
);

incomeRouter.get(
  '/sources',
  asyncHandler(async (req, res) => {
    const summary = await incomeForRange(req.user!.id, todayIso(), addDaysIso(400));
    return sendSuccess(
      res,
      summary.sourceRows.filter(
        (row) =>
          row.is_posted === false && Boolean(row.is_recurring) && row.schedule_status === 'active',
      ),
    );
  }),
);

incomeRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const summary = await incomeForMonth(req.user!.id, month);
    return sendSuccess(res, {
      this_month: summary.this_month,
      ytd: summary.ytd,
      average_month: summary.average_month,
      sources: summary.sources,
      monthly_sources: summary.sourceRows.filter(
        (row) =>
          row.is_posted === false &&
          Boolean(row.is_recurring) &&
          row.schedule_status === 'active' &&
          String(row.frequency ?? '').toLowerCase() === 'monthly',
      ).length,
      actual_transactions: summary.actualRows.length,
    });
  }),
);

incomeRouter.get(
  '/occurrences',
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : addDaysIso(-90);
    const to = typeof req.query.to === 'string' ? req.query.to : todayIso();
    const summary = await incomeForRange(req.user!.id, from, to);
    return sendSuccess(res, summary.rows);
  }),
);

incomeRouter.get(
  '/next-payday',
  asyncHandler(async (req, res) => {
    return sendSuccess(res, await nextPayday(req.user!.id));
  }),
);

incomeRouter.use('/', resourceRouter('income'));
