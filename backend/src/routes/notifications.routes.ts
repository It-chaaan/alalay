import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/api.js";
import { listNotifications, markNotificationsRead, unreadNotificationCount } from "../services/notifications.service.js";

export const notificationsRouter = Router();
notificationsRouter.get("/", asyncHandler(async (req, res) => sendSuccess(res, await listNotifications(req.user!.id))));
notificationsRouter.get("/unread-count", asyncHandler(async (req, res) => sendSuccess(res, { count: await unreadNotificationCount(req.user!.id) })));
notificationsRouter.post("/read", asyncHandler(async (req, res) => { await markNotificationsRead(req.user!.id); return sendSuccess(res, { success: true }); }));
