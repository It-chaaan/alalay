import type { NextFunction, Request, Response } from "express";
import { getSupabase } from "../config/supabase.js";
import { AppError } from "../utils/api.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    next(new AppError(401, "unauthorized", "Missing Authorization bearer token."));
    return;
  }

  const { data, error } = await getSupabase().auth.getUser(token);

  if (error || !data.user) {
    next(new AppError(401, "unauthorized", "Invalid or expired Authorization token."));
    return;
  }

  req.user = {
    id: data.user.id,
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  };

  next();
}
