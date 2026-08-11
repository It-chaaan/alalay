import type { Response } from "express";

export function sendSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export class AppError extends Error {
  status: number;
  code: string;
  details?: string;
  expose: boolean;

  constructor(status: number, code: string, message: string, details?: string, expose = false) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = expose;
  }
}
