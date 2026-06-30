import { Router } from "express";
import { getCapabilities } from "../controllers/ocr.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const ocrRouter = Router();
ocrRouter.get("/capabilities", asyncHandler(getCapabilities));
ocrRouter.post("/demo", asyncHandler(getCapabilities));
