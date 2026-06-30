import type { Request, Response } from "express";
import { chat } from "../services/ai.service.js";
import { sendSuccess } from "../utils/api.js";

export async function sendMessage(_req: Request, res: Response) {
  return sendSuccess(res, await chat());
}
