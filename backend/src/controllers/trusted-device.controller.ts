import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { sendSuccess } from "../utils/api.js";
import { createTrustedDevice, isTrustedDevice } from "../services/trusted-device.service.js";

function cookieHeader(token: string, maxAge: number) {
  return [
    `alalay_trusted_device=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    env.HTTPS_ENABLED ? "SameSite=None" : "SameSite=Lax",
    ...(env.HTTPS_ENABLED ? ["Secure"] : []),
  ].join("; ");
}

export async function checkTrustedDevice(req: Request, res: Response) {
  return sendSuccess(res, { trusted: await isTrustedDevice(req.user!.id, req.header("cookie")) });
}

export async function rememberTrustedDevice(req: Request, res: Response) {
  const device = await createTrustedDevice(req.user!.id, req.header("user-agent"));
  res.setHeader("Set-Cookie", cookieHeader(device.token, 30 * 24 * 60 * 60));
  return sendSuccess(res, { trusted: true, expiresAt: device.expiresAt });
}
