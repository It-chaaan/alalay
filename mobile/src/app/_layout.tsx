import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import 'react-native-reanimated';

import { BrandLockup } from '@/components/brand-lockup';
import { BottomNav } from '@/components/bottom-nav';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';
import { ModalVisibilityProvider, useModalVisibility } from '@/components/modal-visibility';
import { getSupabaseClient } from '@/services/supabase';
import { AppThemeProvider, useAppTheme } from '@/theme/theme';
import { requiresMfa } from '@/services/mfa';

export default function RootLayout() {
  return <AppThemeProvider><ThemedRoot /></AppThemeProvider>;
}

function ThemedRoot() {
  const { colors, resolvedTheme, ready } = useAppTheme();
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.accent} /></View>;
  const base = resolvedTheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = { ...base, colors: { ...base.colors, background: colors.background, card: colors.surface, text: colors.ink, border: colors.line, primary: colors.accent } };
  return <ThemeProvider value={navigationTheme}><ModalVisibilityProvider><SessionGate /></ModalVisibilityProvider><StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} backgroundColor={colors.background} /></ThemeProvider>;
}

function SessionGate() {
  const { colors } = useAppTheme();
  const { modalCount } = useModalVisibility();
  const bottomNavClearance = useBottomNavClearance();
  const pathname = usePathname();
  const screenOwnsClearance = ['/', '/bills', '/budget', '/expenses', '/income', '/reports', '/wallets', '/subscriptions', '/savings'].some((route) => pathname === route || pathname.endsWith(route));
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setCheckingSession(false);
      return;
    }

    let mounted = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setCheckingSession(true);
        setSession(nextSession);
        void (nextSession ? requiresMfa() : Promise.resolve({ required: false })).then((state) => {
          if (!mounted) return;
          setMfaPending(state.required);
          setCheckingSession(false);
        }).catch(() => { if (mounted) { setMfaPending(Boolean(nextSession)); setCheckingSession(false); } });
      }
    });

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return;
      if (error && __DEV__) console.warn('[Auth] Could not restore the saved session.', error);
      setSession(data.session);
      const mfaState = data.session ? await requiresMfa() : { required: false };
      setMfaPending(mfaState.required);
    }).catch((error) => {
      if (__DEV__) console.warn('[Auth] Session restore failed.', error);
      if (mounted) { setSession(null); setMfaPending(false); }
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
    if (session && mfaPending && pathname !== '/auth') {
      router.replace({ pathname: '/auth', params: { mode: 'mfa' } });
    } else if (session && !mfaPending && !inTabs) {
      router.replace('/(tabs)');
    } else if (!session && inTabs) {
      router.replace({ pathname: '/auth', params: { mode: 'signin' } });
    }
  }, [checkingSession, mfaPending, pathname, router, segments, session]);

  if (checkingSession) return <SessionLoadingScreen />;

  return <View style={[styles.appShell, { backgroundColor: colors.background }, session && modalCount === 0 && !screenOwnsClearance && { paddingBottom: bottomNavClearance }]}><Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="auth" />
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
  </Stack>{session ? <BottomNav /> : null}</View>;
}

function SessionLoadingScreen() {
  const { colors } = useAppTheme();
  return <View style={[styles.loading, { backgroundColor: colors.background }]}><BrandLockup color={colors.ink} logoSize={36} textSize={26} /><ActivityIndicator color={colors.accent} style={styles.spinner} /><Text style={[styles.loadingText, { color: colors.muted }]}>Restoring your session…</Text></View>;
}

const styles = StyleSheet.create({
  // The shell owns the shared bottom-nav clearance on secondary screens. Paint
  // that reserved area with the app canvas so navigator defaults cannot bleed
  // through as a cyan/blue strip at the bottom edge.
  appShell: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  spinner: { marginTop: 28 },
  loadingText: { marginTop: 12, fontSize: 13 },
});
