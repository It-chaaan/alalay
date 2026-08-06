import { Router } from "express";
import { checkTrustedDevice, rememberTrustedDevice } from "../controllers/trusted-device.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { trustedDeviceRateLimit } from "../middleware/rateLimit.js";
import { requireSameOrigin } from "../middleware/csrf.js";

export const trustedDeviceRouter = Router();
trustedDeviceRouter.get("/", asyncHandler(checkTrustedDevice));
trustedDeviceRouter.post("/", trustedDeviceRateLimit, requireSameOrigin, asyncHandler(rememberTrustedDevice));
