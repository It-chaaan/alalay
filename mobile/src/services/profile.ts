import { getSupabaseClient } from './supabase';
import { authenticatedApiRequest } from './api';

export type ProfileRecord = {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  avatar_source?: 'profile' | 'provider' | null;
  provider?: string | null;
};

export type CurrentProfile = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  avatarSource: 'profile' | 'provider' | null;
  provider: string | null;
};

type ProfileUpdate = { name: string; phone: string | null };

const cache = new Map<string, CurrentProfile>();
const pending = new Map<string, Promise<CurrentProfile>>();
const listeners = new Set<() => void>();

function getInitialsName(value: string) {
  return value.trim() || 'User';
}

function normalizeProfile(userId: string, email: string, provider: string | null, value: ProfileRecord): CurrentProfile {
  const name = getInitialsName(value.name || email.split('@')[0] || 'User');
  return { userId, name, email, phone: value.phone?.trim() || '', avatarUrl: value.avatar_url || null, avatarSource: value.avatar_source || (value.avatar_url ? 'profile' : null), provider: value.provider || provider };
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
  if (!force && cached) return cached;
  const existing = pending.get(user.id);
  if (!force && existing) return existing;

  const request = authenticatedApiRequest<ProfileRecord>('/api/users/me')
    .then((value) => {
      const profile = normalizeProfile(user.id, user.email || value.email || '', provider, value);
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
  const profile = normalizeProfile(user.id, user.email || value.email || '', provider, value);
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
  return (parts.length === 1 ? parts[0][0] : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
}

export function getProfileFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'there';
}
