import { Router } from "express";
import { me, updateMe } from "../controllers/settings.controller.js";
import { updateProfileSchema } from "../schemas/settings.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";

export const settingsRouter = Router();
settingsRouter.get("/me", asyncHandler(me));
settingsRouter.patch("/me", validateRequest({ body: updateProfileSchema }), asyncHandler(updateMe));
settingsRouter.patch("/me/onboarding", validateRequest({ body: updateProfileSchema.pick({ onboarding_done: true }) }), asyncHandler(updateMe));
