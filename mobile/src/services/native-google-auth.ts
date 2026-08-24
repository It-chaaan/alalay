import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { SupabaseClient } from '@supabase/supabase-js';

import { processMobileAuthCallback } from '@/services/mobile-auth-callback';

export async function signInWithGoogleNative(supabase: SupabaseClient) {
  const redirectTo = Linking.createURL('/auth/callback');
  if (__DEV__) console.info('[Auth] Google OAuth redirect:', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Google sign-in could not start.');

  const authorizationUrl = new URL(data.url);
  const embeddedRedirect = authorizationUrl.searchParams.get('redirect_to');
  if (!embeddedRedirect) throw new Error('Supabase returned an OAuth URL without redirect_to.');
  if (embeddedRedirect !== redirectTo) {
    throw new Error(`Google OAuth redirect mismatch: expected ${redirectTo}, received ${embeddedRedirect}.`);
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    if (result.type === 'cancel') throw new Error('Google sign-in was cancelled.');
    if (result.type === 'dismiss') throw new Error('Google sign-in was dismissed.');
    throw new Error('Google sign-in did not complete.');
  }

  const callback = await processMobileAuthCallback(supabase, result.url);
  return { resultType: result.type, callback };
}
