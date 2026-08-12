import type { Request, Response } from "express";
import { capabilities, demoReceiptScan, parseMobileReceipt } from "../services/ocr.service.js";
import { AppError, sendSuccess } from "../utils/api.js";

export async function getCapabilities(_req: Request, res: Response) {
  return sendSuccess(res, await capabilities());
}

export async function scanDemoReceipt(_req: Request, res: Response) {
  return sendSuccess(res, await demoReceiptScan(), 201);
}

export async function processMobileReceipt(req: Request, res: Response) {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const lines: string[] = Array.isArray(req.body?.lines) ? (req.body.lines as unknown[]).filter((line: unknown): line is string => typeof line === "string").map((line: string) => line.trim()).filter((line: string) => Boolean(line)) : [];
  if (!text || text.length > 50_000 || lines.length > 500 || lines.some((line) => line.length > 500)) {
    throw new AppError(422, "invalid_receipt_text", "Receipt text is missing or too large.", undefined, true);
  }
  return sendSuccess(res, parseMobileReceipt({ text, lines }));
}
