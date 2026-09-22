import { getSupabaseClient } from './supabase';
import { authenticatedApiRequest } from './api';

export type ProfileRecord = {
  id?: string;
  name?: string | null;
  nickname?: string | null;
  onboarding_required?: boolean;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  avatar_path?: string | null;
  avatar_source?: 'uploaded' | 'provider' | null;
  provider?: string | null;
};

export type CurrentProfile = {
  userId: string;
  name: string;
  nickname: string;
  onboardingRequired: boolean;
  email: string;
  phone: string;
  avatarUrl: string | null;
  avatarSource: 'uploaded' | 'provider' | null;
  provider: string | null;
};

type ProfileUpdate = { name: string; nickname?: string; phone: string | null };
const avatarBucket = 'profile-avatars';

const cache = new Map<string, CurrentProfile>();
const pending = new Map<string, Promise<CurrentProfile>>();
const listeners = new Set<() => void>();

function getInitialsName(value: string) {
  return value.trim() || 'User';
}

async function avatarUrl(path: string | null | undefined) {
  if (!path) return null;
  const storage = getSupabaseClient()?.storage.from(avatarBucket);
  if (!storage) return null;
  const { data, error } = await storage.createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}

async function normalizeProfile(
  userId: string,
  email: string,
  provider: string | null,
  value: ProfileRecord,
): Promise<CurrentProfile> {
  const name = getInitialsName(value.name || email.split('@')[0] || 'User');
  const customUrl = await avatarUrl(value.avatar_path);
  return {
    userId,
    name,
    nickname: value.nickname?.trim() || name,
    onboardingRequired: Boolean(value.onboarding_required),
    email,
    phone: value.phone?.trim() || '',
    avatarUrl: customUrl || value.avatar_url || null,
    avatarSource: customUrl
      ? 'uploaded'
      : value.avatar_source === 'provider' || value.avatar_url
        ? 'provider'
        : null,
    provider: value.provider || provider,
  };
}

async function resolveUser() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Authentication is unavailable.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in again before using this feature.');
  const provider = data.user.app_metadata?.provider || data.user.identities?.[0]?.provider || null;
  return { user: data.user, provider };
}

export async function loadCurrentProfile(force = false) {
  const { user, provider } = await resolveUser();
  const cached = cache.get(user.id);
  const existing = pending.get(user.id);
  // A forced refresh must still join a read already in flight. SessionGate and
  // useCurrentProfile mount together during startup; allowing both through
  // creates duplicate /users/me requests and unstable profile notifications.
  if (existing) return existing;
  if (!force && cached) return cached;

  const request = authenticatedApiRequest<ProfileRecord>('/api/users/me')
    .then(async (value) => {
      const profile = await normalizeProfile(
        user.id,
        user.email || value.email || '',
        provider,
        value,
      );
      cache.set(user.id, profile);
      listeners.forEach((listener) => listener());
      return profile;
    })
    .finally(() => pending.delete(user.id));
  pending.set(user.id, request);
  return request;
}

export async function updateCurrentProfile(payload: ProfileUpdate) {
  const { user, provider } = await resolveUser();
  const value = await authenticatedApiRequest<ProfileRecord>('/api/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const profile = await normalizeProfile(user.id, user.email || value.email || '', provider, value);
  cache.set(user.id, profile);
  listeners.forEach((listener) => listener());
  return profile;
}

export async function completeCurrentOnboarding(payload: {
  nickname: string;
  walletName: string;
  openingBalance: number;
  operationId: string;
}) {
  const { user, provider } = await resolveUser();
  const value = await authenticatedApiRequest<ProfileRecord>('/api/users/me/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: payload.nickname,
      wallet_name: payload.walletName,
      opening_balance: payload.openingBalance,
      operation_id: payload.operationId,
    }),
  });
  const profile = await normalizeProfile(user.id, user.email || value.email || '', provider, value);
  cache.set(user.id, profile);
  listeners.forEach((listener) => listener());
  return profile;
}

export async function uploadCurrentAvatar(
  uri: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
) {
  const { user } = await resolveUser();
  const current = await authenticatedApiRequest<ProfileRecord>('/api/users/me');
  const oldPath = current.avatar_path;
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${user.id}/avatar/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const response = await fetch(uri);
  const body = await response.arrayBuffer();
  if (!body.byteLength || body.byteLength > 2 * 1024 * 1024)
    throw new Error('Choose an image smaller than 2 MB.');
  const storage = getSupabaseClient()?.storage.from(avatarBucket);
  if (!storage) throw new Error('Photo upload is unavailable.');
  const { error: uploadError } = await storage.upload(path, body, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw new Error('Your profile photo could not be uploaded.');
  try {
    await authenticatedApiRequest<ProfileRecord>('/api/users/me/avatar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_path: path }),
    });
  } catch (error) {
    await storage.remove([path]);
    throw error;
  }
  if (oldPath && oldPath !== path) await storage.remove([oldPath]);
  return loadCurrentProfile(true);
}

export async function removeCurrentAvatar() {
  const { user, provider } = await resolveUser();
  const current = await authenticatedApiRequest<ProfileRecord>('/api/users/me');
  const oldPath = current.avatar_path;
  const value = await authenticatedApiRequest<ProfileRecord>('/api/users/me/avatar', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar_path: null }),
  });
  if (oldPath) await getSupabaseClient()?.storage.from(avatarBucket).remove([oldPath]);
  const profile = await normalizeProfile(user.id, user.email || value.email || '', provider, value);
  cache.set(user.id, profile);
  listeners.forEach((listener) => listener());
  return profile;
}

export function getCachedCurrentProfile(userId?: string) {
  return userId ? cache.get(userId) || null : null;
}

export function subscribeToCurrentProfile(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProfileInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return (
    parts.length === 1 ? parts[0][0] : `${parts[0][0]}${parts[parts.length - 1][0]}`
  ).toUpperCase();
}

export function getProfileFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'there';
}
