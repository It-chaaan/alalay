import { getSupabaseClient } from './supabase';

type ApiEnvelope<T> = {
  data?: T;
  error?: { message?: string };
};

export async function authenticatedApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const supabase = getSupabaseClient();
  let { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  // Auth state can be restored a moment after the dashboard mounts. Refresh once
  // before reporting a misleading "sign in again" error.
  if (!data.session && supabase) {
    const refreshed = await supabase.auth.refreshSession();
    data = refreshed.data;
  }
  const accessToken = data.session?.access_token;

  if (!apiUrl || !accessToken) {
    throw new Error('Sign in again before using this feature.');
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });
  const payload = await response.json() as ApiEnvelope<T>;

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? 'Something went wrong. Please try again.');
  }

  return payload.data;
}
