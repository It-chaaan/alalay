import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/api.js";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const correlationId = randomUUID();
  const details = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[${correlationId}] request failed`, details);

  if (error instanceof AppError) {
    const isServerError = error.status >= 500;
    res.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: isServerError ? "The service is temporarily unavailable." : error.message,
        correlationId,
        ...(env.NODE_ENV !== "production" ? { details: error.message } : {}),
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: {
      code: "internal_error",
      message: env.NODE_ENV === "production" ? "The service is temporarily unavailable." : "Something went wrong.",
      correlationId,
    },
  });
}
