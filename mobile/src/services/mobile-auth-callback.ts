import * as Linking from 'expo-linking';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type MobileCallbackResult = { mode: string | null; session: Session };

const processedCallbacks = new Set<string>();
const callbackPromises = new Map<string, Promise<MobileCallbackResult>>();

function getCallbackParams(url: string) {
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const hashParams = new URLSearchParams(url.split('#')[1] ?? '');
  const value = (key: string) => {
    const queryValue = query[key];
    return typeof queryValue === 'string' ? queryValue : hashParams.get(key);
  };

  return {
    code: value('code'),
    accessToken: value('access_token'),
    refreshToken: value('refresh_token'),
    error: value('error_description') ?? value('error'),
    mode: value('mode'),
  };
}

export async function processMobileAuthCallback(supabase: SupabaseClient, url: string): Promise<MobileCallbackResult> {
  const existing = callbackPromises.get(url);
  if (existing) return existing;
  if (processedCallbacks.has(url)) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error('This callback was already processed and no mobile session is available.');
    return { mode: null, session: data.session };
  }

  const promise = processMobileAuthCallbackOnce(supabase, url);
  callbackPromises.set(url, promise);
  try {
    const result = await promise;
    processedCallbacks.add(url);
    return result;
  } finally {
    callbackPromises.delete(url);
  }
}

async function processMobileAuthCallbackOnce(supabase: SupabaseClient, url: string): Promise<MobileCallbackResult> {
  if (__DEV__) console.info('[Mobile OAuth] Callback processing started:', true);
  const params = getCallbackParams(url);
  if (params.error) throw new Error(decodeURIComponent(params.error.replace(/\+/g, ' ')));

  if (params.code) {
    const result = await supabase.auth.exchangeCodeForSession(params.code);
    if (result.error) throw result.error;
    if (__DEV__) console.info('[Mobile OAuth] Code exchange succeeded:', true);
  } else if (params.accessToken && params.refreshToken) {
    const result = await supabase.auth.setSession({ access_token: params.accessToken, refresh_token: params.refreshToken });
    if (result.error) throw result.error;
    if (__DEV__) console.info('[Mobile OAuth] Token session exchange succeeded:', true);
  } else {
    throw new Error('This confirmation link is missing the required parameters or has already been used.');
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('Google sign-in did not establish a mobile session.');
  if (__DEV__) console.info('[Mobile OAuth] Session established:', true);
  return { mode: params.mode, session: data.session };
}
