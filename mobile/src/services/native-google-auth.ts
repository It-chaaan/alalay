import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { SupabaseClient } from '@supabase/supabase-js';

import { processMobileAuthCallback } from '@/services/mobile-auth-callback';

WebBrowser.maybeCompleteAuthSession();

function redirectParts(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return { scheme: parsed.protocol.replace(':', ''), pathname: parsed.pathname };
  } catch {
    return null;
  }
}

export async function signInWithGoogleNative(supabase: SupabaseClient) {
  const redirectTo = Linking.createURL('/auth/callback');
  if (__DEV__) console.info('[Mobile OAuth] Generated redirect:', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (__DEV__) console.info('[Mobile OAuth] Supabase data.url exists:', Boolean(data.url));
  if (!data.url) throw new Error('Google sign-in could not start.');

  let embeddedRedirect: string | null;
  try {
    embeddedRedirect = new URL(data.url).searchParams.get('redirect_to');
  } catch {
    throw new Error('Supabase returned an invalid OAuth URL.');
  }
  const embeddedParts = redirectParts(embeddedRedirect);
  if (__DEV__) console.info('[Mobile OAuth] Supabase redirect_to:', embeddedParts ? `${embeddedParts.scheme} ${embeddedParts.pathname}` : 'missing or invalid');
  if (!embeddedRedirect) throw new Error('Supabase returned an OAuth URL without redirect_to.');
  if (__DEV__) console.info('[Mobile OAuth] Redirect matches:', embeddedRedirect === redirectTo);
  if (embeddedRedirect !== redirectTo) {
    throw new Error(`Google OAuth redirect mismatch: expected ${redirectTo}, received ${embeddedRedirect}.`);
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (__DEV__) console.info('[Mobile OAuth] Browser result:', result.type);
  if (result.type !== 'success') {
    if (result.type === 'cancel') throw new Error('Google sign-in was cancelled.');
    if (result.type === 'dismiss') throw new Error('Google sign-in was dismissed.');
    throw new Error('Google sign-in did not complete.');
  }

  const callbackParts = redirectParts(result.url);
  if (__DEV__) {
    console.info('[Mobile OAuth] Returned URL exists:', Boolean(result.url));
    console.info('[Mobile OAuth] Returned scheme:', callbackParts?.scheme ?? 'missing');
    console.info('[Mobile OAuth] Returned path:', callbackParts?.pathname ?? 'missing');
    console.info('[Mobile OAuth] Callback received:', Boolean(result.url));
  }
  const callback = await processMobileAuthCallback(supabase, result.url);
  return { resultType: result.type, callback };
}
