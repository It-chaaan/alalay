import { Router } from "express";
import * as controller from "../controllers/wallets.controller.js";
import { idParamSchema } from "../schemas/common.schema.js";
import { createWalletSchema, updateWalletSchema, walletDepositSchema } from "../schemas/wallet.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

export const walletsRouter = Router();
walletsRouter.get("/", asyncHandler(controller.list));
walletsRouter.get("/:id", validateRequest({ params: idParamSchema }), asyncHandler(controller.get));
walletsRouter.post("/", writeRateLimit, validateRequest({ body: createWalletSchema }), asyncHandler(controller.create));
walletsRouter.post("/:id/deposits", writeRateLimit, validateRequest({ params: idParamSchema, body: walletDepositSchema }), asyncHandler(controller.deposit));
walletsRouter.patch("/:id", writeRateLimit, validateRequest({ params: idParamSchema, body: updateWalletSchema }), asyncHandler(controller.update));
walletsRouter.delete("/:id", writeRateLimit, validateRequest({ params: idParamSchema }), asyncHandler(controller.remove));
