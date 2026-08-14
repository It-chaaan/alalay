import type { Request, Response } from "express";
import { capabilities, demoReceiptScan, parseMobileReceipt } from "../services/ocr.service.js";
import { ReceiptOcrTimeoutError, recognizeReceiptImage } from "../services/receipt-ocr.service.js";
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

export async function scanReceiptImage(req: Request, res: Response) {
  if (!req.file) throw new AppError(422, "missing_receipt_image", "Choose a JPEG or PNG receipt image.", undefined, true);
  const isJpeg = req.file.buffer.length >= 3 && req.file.buffer[0] === 0xff && req.file.buffer[1] === 0xd8 && req.file.buffer[2] === 0xff;
  const isPng = req.file.buffer.length >= 8 && req.file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isJpeg && !isPng) throw new AppError(422, "invalid_receipt_image", "Upload a valid JPEG or PNG receipt image.", undefined, true);
  try {
    const result = await recognizeReceiptImage(req.file.buffer);
    return sendSuccess(res, { success: true, ocr: { rawText: result.rawText, confidence: result.confidence }, receipt: result.receipt, image: { retained: false }, metadata: result.metadata });
  } catch (error) {
    if (error instanceof ReceiptOcrTimeoutError) throw new AppError(504, "ocr_timeout", "We couldn't read this receipt in time. Try taking a clearer photo.", undefined, true);
    throw new AppError(422, "ocr_failed", "We couldn't read this receipt. Try taking a clearer photo.", undefined, true);
  }
}
