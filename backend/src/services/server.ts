import fs from 'node:fs';
import https from 'node:https';
import cors from 'cors';
import express, { type RequestHandler } from 'express';
import { allowedCorsOrigins, env } from '../config/env.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { apiRouter } from '../routes/index.js';
import { processIncomeSchedules } from './income-scheduler.service.js';
import { runBillingScheduler } from './billing-scheduler.service.js';
import { runNotificationScheduler } from './notification-scheduler.service.js';
import { timingSafeEqual } from 'node:crypto';

type SchedulerJob = 'income' | 'billing' | 'notifications';

function hasSchedulerSecret(value: string | undefined, expected: string | undefined) {
  if (!value || !expected) return false;
  const received = Buffer.from(value);
  const configured = Buffer.from(expected);
  return received.length === configured.length && timingSafeEqual(received, configured);
}

export function createServer() {
  const app = express();
  app.set('trust proxy', 1);

  const allowedOrigins = allowedCorsOrigins();
  app.use(
    cors({
      origin(origin, callback) {
        // Native clients send no Origin header. Browser callers must be an explicitly
        // configured production origin or one of the Expo web preview origins.
        callback(null, !origin || allowedOrigins.has(origin));
      },
      credentials: true,
    }),
  );
  app.use((_req, res, next) => {
    if (env.HTTPS_ENABLED) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      const forwardedProto = _req.header('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
      if (!_req.secure && forwardedProto !== 'https') {
        res.status(403).json({
          success: false,
          error: { code: 'https_required', message: 'HTTPS is required.' },
        });
        return;
      }
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
      const clientRequestId = req.header('x-request-id');
      res.on('finish', () => {
        console.info(
          `[API] ${req.method} ${req.originalUrl} -> ${res.statusCode}${clientRequestId ? ` client=${clientRequestId}` : ''}`,
        );
      });
      next();
    });
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Deliberately outside the user API. A single durable scheduler should invoke
  // these idempotent jobs; no mobile or web client receives this secret.
  const runScheduler: RequestHandler = async (req, res, next) => {
    const job = req.params.job as SchedulerJob;
    if (!['income', 'billing', 'notifications'].includes(job) || !hasSchedulerSecret(req.header('x-scheduler-secret'), env.INCOME_SCHEDULER_SECRET)) {
      res.status(401).json({
        success: false,
        error: { code: 'unauthorized', message: 'Scheduler authentication failed.' },
      });
      return;
    }
    try {
      const result = job === 'income'
        ? { processed: await processIncomeSchedules() }
        : job === 'billing'
          ? await runBillingScheduler()
          : await runNotificationScheduler();
      res.json({ success: true, data: { job, ...result } });
    } catch (error) {
      next(error);
    }
  };
  app.post('/internal/scheduler/:job', runScheduler);

  // Compatibility for an already-configured external scheduler. Remove after
  // the deployment has switched to /internal/scheduler/income.
  app.post('/internal/income-scheduler', (req, _res, next) => {
    req.params.job = 'income';
    next();
  }, runScheduler);

  app.use('/api', apiRouter);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'not_found',
        message: 'Route not found.',
      },
    });
  });

  app.use(errorHandler);

  if (env.HTTPS_TERMINATE_LOCALLY) {
    if (!env.HTTPS_CERT_PATH || !env.HTTPS_KEY_PATH) {
      throw new Error(
        'HTTPS_TERMINATE_LOCALLY is enabled but HTTPS_CERT_PATH or HTTPS_KEY_PATH is missing.',
      );
    }

    return https.createServer(
      {
        cert: fs.readFileSync(env.HTTPS_CERT_PATH),
        key: fs.readFileSync(env.HTTPS_KEY_PATH),
      },
      app,
    );
  }

  return app;
}
