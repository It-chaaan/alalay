import { Router } from "express";
import { me, notificationPreferences, overviewPreferences, updateMe, updateNotificationPreferencesController, updateOverviewPreferencesController } from "../controllers/settings.controller.js";
import { notificationPreferencesSchema, overviewPreferencesSchema, updateProfileSchema } from "../schemas/settings.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

export const settingsRouter = Router();
settingsRouter.get("/me", asyncHandler(me));
settingsRouter.patch("/me", writeRateLimit, validateRequest({ body: updateProfileSchema }), asyncHandler(updateMe));
settingsRouter.patch("/me/onboarding", writeRateLimit, validateRequest({ body: updateProfileSchema.pick({ onboarding_done: true }) }), asyncHandler(updateMe));
settingsRouter.get("/me/notification-preferences", asyncHandler(notificationPreferences));
settingsRouter.patch("/me/notification-preferences", writeRateLimit, validateRequest({ body: notificationPreferencesSchema }), asyncHandler(updateNotificationPreferencesController));
settingsRouter.get("/me/dashboard-preferences", asyncHandler(overviewPreferences));
settingsRouter.patch("/me/dashboard-preferences", writeRateLimit, validateRequest({ body: overviewPreferencesSchema }), asyncHandler(updateOverviewPreferencesController));
