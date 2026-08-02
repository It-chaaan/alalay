import type { Request, Response } from "express";
import { getNotificationPreferences, getProfile, updateNotificationPreferences, updateProfile } from "../services/settings.service.js";
import { sendSuccess } from "../utils/api.js";

export async function me(req: Request, res: Response) {
  return sendSuccess(res, await getProfile(req.user!.id));
}

export async function updateMe(req: Request, res: Response) {
  return sendSuccess(res, await updateProfile(req.user!.id, req.validated?.body as Record<string, unknown>));
}

export async function notificationPreferences(req: Request, res: Response) {
  return sendSuccess(res, await getNotificationPreferences(req.user!.id));
}

export async function updateNotificationPreferencesController(req: Request, res: Response) {
  return sendSuccess(res, await updateNotificationPreferences(req.user!.id, req.validated?.body as Record<string, unknown>));
}
