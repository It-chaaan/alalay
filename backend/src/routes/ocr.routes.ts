import { Router } from "express";
import { getCapabilities, processMobileReceipt, scanDemoReceipt } from "../controllers/ocr.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ocrRateLimit } from "../middleware/rateLimit.js";

export const ocrRouter = Router();
ocrRouter.get("/capabilities", asyncHandler(getCapabilities));
ocrRouter.post("/demo", ocrRateLimit, asyncHandler(scanDemoReceipt));
ocrRouter.post("/mobile/receipt", ocrRateLimit, asyncHandler(processMobileReceipt));
