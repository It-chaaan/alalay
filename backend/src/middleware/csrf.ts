import type { NextFunction, Request, Response } from "express";
import { allowedCorsOrigins } from "../config/env.js";
import { AppError } from "../utils/api.js";

function allowedOrigin(value: string | undefined) {
  if (!value) return false;
  try {
    return allowedCorsOrigins().has(value);
  } catch {
    return false;
  }
}

export function requireSameOrigin(req: Request, _res: Response, next: NextFunction) {
  const origin = req.header("origin");
  const referer = req.header("referer");
  if (!allowedOrigin(origin) && !(origin === undefined && allowedOrigin(referer ? new URL(referer).origin : undefined))) {
    next(new AppError(403, "csrf_rejected", "Request origin could not be verified."));
    return;
  }
  next();
}
