import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/api.js";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const correlationId = randomUUID();
  const details = error instanceof AppError && error.details
    ? error.details
    : error instanceof Error ? error.stack || error.message : String(error);
  const status = error instanceof AppError ? error.status : 500;
  const code = error instanceof AppError ? error.code : "internal_error";
  console.error(`[API] ${req.method} ${req.originalUrl} -> ${status} ${code} [${correlationId}]`, details);

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ success: false, error: { code: "invalid_json", message: "The request body is not valid JSON.", correlationId } });
    return;
  }

  if (error instanceof AppError) {
    const isServerError = error.status >= 500 && !error.expose;
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
