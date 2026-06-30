import type { Request, Response } from "express";
import { capabilities } from "../services/ocr.service.js";
import { sendSuccess } from "../utils/api.js";

export async function getCapabilities(_req: Request, res: Response) {
  return sendSuccess(res, await capabilities());
}
