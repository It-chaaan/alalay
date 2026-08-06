import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/api.js";

type RateLimitOptions = {
  windowMs: number;
  limit: number;
  name: string;
};

type Counter = { count: number; resetAt: number };

// This process-local store is intentionally small. Production deployments with
// multiple instances must back this policy with a shared gateway/Redis store.
export function createRateLimiter({ windowMs, limit, name }: RateLimitOptions) {
  const counters = new Map<string, Counter>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const account = String(req.user?.id || req.body?.email || req.body?.identifier || "anonymous")
      .trim()
      .toLowerCase()
      .slice(0, 256);
    const key = `${name}:${ip}:${account}`;
    const current = counters.get(key);
    const counter = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    counter.count += 1;
    counters.set(key, counter);

    if (counter.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((counter.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      next(new AppError(429, "rate_limited", "Too many requests. Please try again later."));
      return;
    }

    // Prevent an unbounded process-local map from becoming a memory sink.
    if (counters.size > 10_000) {
      for (const [storedKey, storedCounter] of counters) {
        if (storedCounter.resetAt <= now) counters.delete(storedKey);
      }
    }

    next();
  };
}

export const writeRateLimit = createRateLimiter({ name: "write", windowMs: 60_000, limit: 60 });
export const aiRateLimit = createRateLimiter({ name: "ai", windowMs: 60_000, limit: 12 });
export const ocrRateLimit = createRateLimiter({ name: "ocr", windowMs: 60_000, limit: 8 });
export const trustedDeviceRateLimit = createRateLimiter({ name: "trusted-device", windowMs: 60_000, limit: 5 });
