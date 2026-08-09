import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import 'react-native-reanimated';

import { BrandLockup } from '@/components/brand-lockup';
import { getSupabaseClient } from '@/services/supabase';

const palette = { background: '#F4F7F1', ink: '#11231C', muted: '#5D6C65', accent: '#0F8A6B' };

export default function RootLayout() {
  return <ThemeProvider value={DefaultTheme}><SessionGate /><StatusBar style="dark" /></ThemeProvider>;
}

function SessionGate() {
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setCheckingSession(false);
      return;
    }

    let mounted = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error && __DEV__) console.warn('[Auth] Could not restore the saved session.', error);
      setSession(data.session);
    }).catch((error) => {
      if (__DEV__) console.warn('[Auth] Session restore failed.', error);
      if (mounted) setSession(null);
    }).finally(() => {
      if (mounted) setCheckingSession(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (checkingSession) return;
    const inTabs = segments[0] === '(tabs)';
    if (session && !inTabs) {
      router.replace('/(tabs)');
    } else if (!session && inTabs) {
      router.replace({ pathname: '/auth', params: { mode: 'signin' } });
    }
  }, [checkingSession, router, segments, session]);

  if (checkingSession) return <SessionLoadingScreen />;

  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="auth" />
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
  </Stack>;
}

function SessionLoadingScreen() {
  return <View style={styles.loading}><BrandLockup color={palette.ink} logoSize={36} textSize={26} /><ActivityIndicator color={palette.accent} style={styles.spinner} /><Text style={styles.loadingText}>Restoring your session…</Text></View>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: palette.background },
  spinner: { marginTop: 28 },
  loadingText: { marginTop: 12, color: palette.muted, fontSize: 13 },
});
