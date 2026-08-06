import { Router } from "express";
import * as controller from "../controllers/bills.controller.js";
import { idParamSchema } from "../schemas/common.schema.js";
import { billQuerySchema, createBillSchema, updateBillSchema } from "../schemas/bill.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

export const billsRouter = Router();

billsRouter.get("/", validateRequest({ query: billQuerySchema }), asyncHandler(controller.list));
billsRouter.get("/:id", validateRequest({ params: idParamSchema }), asyncHandler(controller.get));
billsRouter.post("/", writeRateLimit, validateRequest({ body: createBillSchema }), asyncHandler(controller.create));
billsRouter.patch("/:id", writeRateLimit, validateRequest({ params: idParamSchema, body: updateBillSchema }), asyncHandler(controller.update));
billsRouter.patch("/:id/pay", writeRateLimit, validateRequest({ params: idParamSchema }), asyncHandler(controller.pay));
billsRouter.delete("/:id", writeRateLimit, validateRequest({ params: idParamSchema }), asyncHandler(controller.remove));
