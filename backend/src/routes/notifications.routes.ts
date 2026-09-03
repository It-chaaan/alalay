import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/api.js";
import { listNotifications, markNotificationRead, markNotificationUnread, markNotificationsRead, syncBillReminders, unreadNotificationCount } from "../services/notifications.service.js";

export const notificationsRouter = Router();
// The inbox has no server response cache; every post-sync read must observe
// the newly committed notification and unread count.
notificationsRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});
notificationsRouter.get("/", asyncHandler(async (req, res) => sendSuccess(res, await listNotifications(req.user!.id))));
notificationsRouter.get("/unread-count", asyncHandler(async (req, res) => sendSuccess(res, { count: await unreadNotificationCount(req.user!.id) })));
notificationsRouter.post("/sync-bill-reminders", asyncHandler(async (req, res) => sendSuccess(res, await syncBillReminders(req.user!.id))));
notificationsRouter.post("/read", asyncHandler(async (req, res) => { await markNotificationsRead(req.user!.id); return sendSuccess(res, { success: true }); }));
notificationsRouter.post("/:id/read", asyncHandler(async (req, res) => { await markNotificationRead(req.user!.id, String(req.params.id)); return sendSuccess(res, { success: true }); }));
notificationsRouter.post("/:id/unread", asyncHandler(async (req, res) => { await markNotificationUnread(req.user!.id, String(req.params.id)); return sendSuccess(res, { success: true }); }));
