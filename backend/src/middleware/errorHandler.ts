import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/api.js";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    res.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  console.error(error);
  const details = error instanceof Error ? error.message : null;

  res.status(500).json({
    success: false,
    error: {
      code: "internal_error",
      message: details || "Something went wrong.",
    },
  });
}
