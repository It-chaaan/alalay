import { Router } from "express";
import { incomeSummary } from "../services/resource.service.js";
import { sendSuccess } from "../utils/api.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { resourceRouter } from "./resource.routes.js";

export const incomeRouter = Router();

incomeRouter.get("/summary", asyncHandler(async (req, res) => {
  return sendSuccess(res, await incomeSummary(req.user!.id));
}));

incomeRouter.use("/", resourceRouter("income"));
