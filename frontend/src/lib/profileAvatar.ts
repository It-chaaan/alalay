import { getSupabaseClient } from "./supabase";

const MAX_PROFILE_AVATAR_BYTES = 2 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadProfileAvatar(userId: string, file: File) {
  if (!allowedTypes.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_PROFILE_AVATAR_BYTES) {
    throw new Error("Profile images must be 2 MB or smaller.");
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Profile image storage is unavailable.");

  const path = `${userId}/avatar`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: true,
  });
  if (error) throw new Error("Unable to upload profile image.");

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  if (!data.publicUrl || data.publicUrl.length > 500) throw new Error("Unable to create profile image URL.");
  return `${data.publicUrl}?v=${Date.now()}`;
}
