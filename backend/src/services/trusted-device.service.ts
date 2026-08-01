import { createHash, randomBytes } from "node:crypto";
import { getSupabase } from "../config/supabase.js";
import { AppError } from "../utils/api.js";

export const trustedDeviceCookieName = "alalay_trusted_device";
export const trustedDeviceLifetimeSeconds = 30 * 24 * 60 * 60;

export function hashTrustedDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(header: string | undefined, name: string) {
  if (!header) return null;

  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
  }

  return null;
}

export async function isTrustedDevice(userId: string, cookieHeader: string | undefined) {
  const token = readCookie(cookieHeader, trustedDeviceCookieName);
  if (!token) return false;

  const { data, error } = await getSupabase()
    .from("trusted_devices")
    .select("id")
    .eq("user_id", userId)
    .eq("token_hash", hashTrustedDeviceToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new AppError(500, "trusted_device_lookup_failed", "Unable to check trusted device.");
  return Boolean(data);
}

export async function createTrustedDevice(userId: string, userAgent: string | undefined) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + trustedDeviceLifetimeSeconds * 1000).toISOString();

  const { error } = await getSupabase().from("trusted_devices").insert({
    user_id: userId,
    token_hash: hashTrustedDeviceToken(token),
    expires_at: expiresAt,
    user_agent: userAgent?.slice(0, 500) || null,
  });

  if (error) throw new AppError(500, "trusted_device_create_failed", "Unable to remember this device.");
  return { token, expiresAt };
}
