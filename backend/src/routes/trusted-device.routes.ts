import { Router } from "express";
import { checkTrustedDevice, rememberTrustedDevice } from "../controllers/trusted-device.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const trustedDeviceRouter = Router();
trustedDeviceRouter.get("/", asyncHandler(checkTrustedDevice));
trustedDeviceRouter.post("/", asyncHandler(rememberTrustedDevice));
