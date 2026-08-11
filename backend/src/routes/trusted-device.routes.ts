import { Router } from "express";
import { checkTrustedDevice, rememberTrustedDevice } from "../controllers/trusted-device.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { trustedDeviceRateLimit } from "../middleware/rateLimit.js";
import { requireSameOrigin } from "../middleware/csrf.js";

function requireTrustedDeviceOrigin(req: Parameters<typeof requireSameOrigin>[0], res: Parameters<typeof requireSameOrigin>[1], next: Parameters<typeof requireSameOrigin>[2]) {
  if (req.header("x-client-platform") === "mobile") {
    next();
    return;
  }
  requireSameOrigin(req, res, next);
}

export const trustedDeviceRouter = Router();
trustedDeviceRouter.get("/", asyncHandler(checkTrustedDevice));
trustedDeviceRouter.post("/", trustedDeviceRateLimit, requireTrustedDeviceOrigin, asyncHandler(rememberTrustedDevice));
