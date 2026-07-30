import { Router } from "express";
import { sendMessage, status, streamMessage } from "../controllers/ai.controller.js";
import { aiChatSchema } from "../schemas/ai.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";

export const aiRouter = Router();
aiRouter.get("/status", asyncHandler(status));
aiRouter.post("/chat", validateRequest({ body: aiChatSchema }), asyncHandler(sendMessage));
aiRouter.post("/chat/stream", validateRequest({ body: aiChatSchema }), asyncHandler(streamMessage));
