import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { getCapabilities, processMobileReceipt, scanDemoReceipt, scanReceiptImage } from "../controllers/ocr.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ocrRateLimit } from "../middleware/rateLimit.js";
import { AppError } from "../utils/api.js";

export const ocrRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => {
  if (["image/jpeg", "image/png"].includes(file.mimetype)) callback(null, true);
  else callback(new Error("unsupported receipt image") as never, false);
} });
function receiptUpload(req: Request, res: Response, next: NextFunction) {
  upload.single("image")(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") return next(new AppError(413, "receipt_too_large", "Receipt images must be 10 MB or smaller.", undefined, true));
    return next(new AppError(422, "invalid_receipt_image", "Upload a JPEG or PNG receipt image.", undefined, true));
  });
}
ocrRouter.get("/capabilities", asyncHandler(getCapabilities));
ocrRouter.post("/demo", ocrRateLimit, asyncHandler(scanDemoReceipt));
ocrRouter.post("/mobile/receipt", ocrRateLimit, asyncHandler(processMobileReceipt));
ocrRouter.post("/receipt", ocrRateLimit, receiptUpload, asyncHandler(scanReceiptImage));
