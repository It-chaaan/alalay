import type { Request, Response } from "express";
import { getNotificationPreferences, getOverviewPreferences, getProfile, updateAvatarPath, updateNotificationPreferences, updateOverviewPreferences, updateProfile } from "../services/settings.service.js";
import { sendSuccess } from "../utils/api.js";

export async function me(req: Request, res: Response) {
  return sendSuccess(res, await getProfile(req.user!.id, req.user!.email, req.user!.user_metadata));
}

export async function updateMe(req: Request, res: Response) {
  return sendSuccess(res, await updateProfile(req.user!.id, req.validated?.body as Record<string, unknown>));
}
export async function updateAvatar(req: Request, res: Response) {
  const body = req.validated?.body as { avatar_path?: string | null };
  return sendSuccess(res, await updateAvatarPath(req.user!.id, body.avatar_path ?? null));
}

export async function notificationPreferences(req: Request, res: Response) {
  return sendSuccess(res, await getNotificationPreferences(req.user!.id));
}

export async function updateNotificationPreferencesController(req: Request, res: Response) {
  return sendSuccess(res, await updateNotificationPreferences(req.user!.id, req.validated?.body as Record<string, unknown>));
}

export async function overviewPreferences(req: Request, res: Response) {
  return sendSuccess(res, await getOverviewPreferences(req.user!.id));
}

export async function updateOverviewPreferencesController(req: Request, res: Response) {
  return sendSuccess(res, await updateOverviewPreferences(req.user!.id, req.validated?.body as Record<string, unknown>));
}
