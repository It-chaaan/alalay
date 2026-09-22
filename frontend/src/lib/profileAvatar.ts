import { getSupabaseClient } from './supabase';

const MAX_PROFILE_AVATAR_BYTES = 2 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const profileAvatarBucket = 'profile-avatars';

export async function uploadProfileAvatar(userId: string, file: File) {
  if (!allowedTypes.has(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size > MAX_PROFILE_AVATAR_BYTES) {
    throw new Error('Profile images must be 2 MB or smaller.');
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Profile image storage is unavailable.');

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/avatar/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(profileAvatarBucket).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error('Unable to upload profile image.');
  return path;
}

export async function removeProfileAvatar(path: string | null | undefined) {
  if (!path) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.storage.from(profileAvatarBucket).remove([path]);
}

export async function getProfileAvatarUrl(
  path: string | null | undefined,
  version?: string | null,
) {
  if (!path) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(profileAvatarBucket)
    .createSignedUrl(path, 60 * 60);
  if (error || !data.signedUrl) return null;
  return `${data.signedUrl}${data.signedUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(version || path)}`;
}
