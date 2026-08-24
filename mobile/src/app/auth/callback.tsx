import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSupabaseClient } from '@/services/supabase';
import { useAppTheme } from '@/theme/theme';

type CallbackState = 'loading' | 'success' | 'error';

function callbackParams(url: string) {
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const hash = url.split('#')[1] ?? '';
  const hashParams = new URLSearchParams(hash);
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

export default function AuthCallbackScreen() {
  const { colors } = useAppTheme();
  const [state, setState] = useState<CallbackState>('loading');
  const [error, setError] = useState('');
  const processedUrl = useRef<string | null>(null);
  const url = Linking.useURL();

  useEffect(() => {
    const process = async (url: string | null) => {
      if (!url || processedUrl.current === url) return;
      processedUrl.current = url;
      const params = callbackParams(url);
      if (params.error) {
        setError(decodeURIComponent(params.error.replace(/\+/g, ' ')));
        setState('error');
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('Authentication is unavailable in this app build.');
        setState('error');
        return;
      }

      try {
        if (params.code) {
          const result = await supabase.auth.exchangeCodeForSession(params.code);
          if (result.error) throw result.error;
        } else if (params.accessToken && params.refreshToken) {
          const result = await supabase.auth.setSession({
            access_token: params.accessToken,
            refresh_token: params.refreshToken,
          });
          if (result.error) throw result.error;
        } else {
          throw new Error('This confirmation link is missing the required parameters or has already been used.');
        }
        setState('success');
        router.replace(params.mode === 'recovery' ? '/settings/change-password' : '/(tabs)');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'This confirmation link could not be verified.');
        setState('error');
      }
    };

    void process(url);
  }, [url]);

  if (state === 'loading') {
    return <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.accent} /><Text style={[styles.title, { color: colors.ink }]}>Confirming your email…</Text></SafeAreaView>;
  }

  if (state === 'success') {
    return <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.ink }]}>Email confirmed</Text><Text style={[styles.copy, { color: colors.muted }]}>Your email is confirmed. Opening Alalay…</Text></SafeAreaView>;
  }

  return <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.ink }]}>Confirmation link unavailable</Text><Text style={[styles.copy, { color: colors.muted }]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/auth', params: { mode: 'signin' } })} style={[styles.action, { backgroundColor: colors.accent }]}><Text style={styles.actionText}>Sign in</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/auth', params: { mode: 'create' } })} style={styles.secondaryAction}><Text style={[styles.secondaryText, { color: colors.accent }]}>Resend confirmation</Text></Pressable></SafeAreaView>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { marginTop: 16, textAlign: 'center', fontSize: 22, fontWeight: '900' },
  copy: { maxWidth: 330, marginTop: 10, textAlign: 'center', fontSize: 14, lineHeight: 21 },
  action: { minWidth: 180, minHeight: 48, marginTop: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  actionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryAction: { minHeight: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '800' },
});
