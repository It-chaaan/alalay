import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { AppError } from "../utils/api.js";

function allowedOrigin(value: string | undefined) {
  if (!value) return false;
  try {
    const configured = env.CORS_ORIGIN.split(",").map((item) => item.trim());
    return configured.includes(value) || new URL(env.APP_URL).origin === value;
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
