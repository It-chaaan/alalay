import { Router } from "express";
import { completeOnboarding, me, notificationPreferences, overviewPreferences, updateAvatar, updateMe, updateNotificationPreferencesController, updateOverviewPreferencesController } from "../controllers/settings.controller.js";
import { completeOnboardingSchema, notificationPreferencesSchema, overviewPreferencesSchema, updateAvatarSchema, updateProfileSchema } from "../schemas/settings.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

export const settingsRouter = Router();
settingsRouter.get("/me", asyncHandler(me));
settingsRouter.patch("/me", writeRateLimit, validateRequest({ body: updateProfileSchema }), asyncHandler(updateMe));
settingsRouter.patch("/me/avatar", writeRateLimit, validateRequest({ body: updateAvatarSchema }), asyncHandler(updateAvatar));
settingsRouter.post("/me/onboarding", writeRateLimit, validateRequest({ body: completeOnboardingSchema }), asyncHandler(completeOnboarding));
settingsRouter.get("/me/notification-preferences", asyncHandler(notificationPreferences));
settingsRouter.patch("/me/notification-preferences", writeRateLimit, validateRequest({ body: notificationPreferencesSchema }), asyncHandler(updateNotificationPreferencesController));
settingsRouter.get("/me/dashboard-preferences", asyncHandler(overviewPreferences));
settingsRouter.patch("/me/dashboard-preferences", writeRateLimit, validateRequest({ body: overviewPreferencesSchema }), asyncHandler(updateOverviewPreferencesController));
