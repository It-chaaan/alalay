import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { AppError } from "../utils/api.js";

export function validateRequest(schema: {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const validated: Request["validated"] = {};

    for (const key of ["body", "query", "params"] as const) {
      const validator = schema[key];
      if (!validator) continue;

      const result = validator.safeParse(req[key]);
      if (!result.success) {
        const firstIssue = result.error.issues[0];
        const field = firstIssue?.path.join(".") || key;
        next(new AppError(400, "validation_error", `${field}: ${firstIssue?.message || "Invalid value."}`));
        return;
      }

      validated[key] = result.data;
    }

    req.validated = { ...req.validated, ...validated };
    next();
  };
}
