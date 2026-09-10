import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Href, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Session } from '@supabase/supabase-js';
import 'react-native-reanimated';

import { BrandLockup } from '@/components/brand-lockup';
import { BottomNav } from '@/components/bottom-nav';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';
import { ModalVisibilityProvider, useModalVisibility } from '@/components/modal-visibility';
import { ToastProvider } from '@/components/toast-provider';
import { getSupabaseClient } from '@/services/supabase';
import { AppThemeProvider, useAppTheme } from '@/theme/theme';
import { requiresMfa } from '@/services/mfa';
import { cancelAllFinancialReminders, reconcileOnAppResume } from '@/services/financial-reminders';
import { IncomeWorkflowProvider } from '@/context/income-workflow';
import { DashboardInsightProvider } from '@/context/dashboard-insight';
import { loadCurrentProfile } from '@/services/profile';
import { sessionGateDestination } from '@/utils/session-gate';
import { createRedirectGuard } from '@/utils/redirect-guard';

const stackScreenOptions = { headerShown: false } as const;

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <ThemedRoot />
    </AppThemeProvider>
  );
}

function ThemedRoot() {
  const { colors, resolvedTheme, ready } = useAppTheme();
  const base = resolvedTheme === 'dark' ? DarkTheme : DefaultTheme;
  // This hook must run before the loading return. The previous placement made
  // the initial theme hydration render use fewer hooks than the ready render.
  const navigationTheme = useMemo(() => ({
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.ink,
      border: colors.line,
      primary: colors.accent,
    },
  }), [base, colors]);
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  return (
    <ThemeProvider value={navigationTheme}>
      <ModalVisibilityProvider>
        <ToastProvider>
          <SessionGate />
        </ToastProvider>
      </ModalVisibilityProvider>
      <StatusBar
        style={resolvedTheme === 'dark' ? 'light' : 'dark'}
      />
    </ThemeProvider>
  );
}

function SessionGate() {
  const { colors } = useAppTheme();
  const { modalCount } = useModalVisibility();
  const bottomNavClearance = useBottomNavClearance();
  const pathname = usePathname();
  const screenOwnsClearance = [
    '/',
    '/bills',
    '/budget',
    '/expenses',
    '/ai',
    '/income',
    '/reports',
    '/wallets',
    '/subscriptions',
    '/savings',
  ].some((route) => pathname === route || pathname.endsWith(route));
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const redirectGuard = useRef(createRedirectGuard()).current;
  const sessionUserId = session?.user.id ?? null;

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setCheckingSession(false);
      return;
    }

    let mounted = true;
    let activeUserId: string | null = null;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        const nextUserId = nextSession?.user.id ?? null;
        if (nextUserId !== activeUserId) {
          activeUserId = nextUserId;
          // The OS queue is process-global; remove the previous account's
          // reminders before the new account can reconcile its own bills.
          void cancelAllFinancialReminders();
        }
        setCheckingSession(true);
        setSession(nextSession);
        void (nextSession ? requiresMfa() : Promise.resolve({ required: false }))
          .then((state) => {
            if (!mounted) return;
            setMfaPending(state.required);
            setCheckingSession(false);
          })
          .catch(() => {
            if (mounted) {
              setMfaPending(Boolean(nextSession));
              setCheckingSession(false);
            }
          });
      }
    });

    void supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (error && __DEV__) console.warn('[Auth] Could not restore the saved session.', error);
        await cancelAllFinancialReminders();
        if (!mounted) return;
        setSession(data.session);
        const mfaState = data.session ? await requiresMfa() : { required: false };
        setMfaPending(mfaState.required);
      })
      .catch((error) => {
        if (__DEV__) console.warn('[Auth] Session restore failed.', error);
        if (mounted) {
          setSession(null);
          setMfaPending(false);
        }
      })
      .finally(() => {
        if (mounted) setCheckingSession(false);
      });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionUserId || mfaPending) {
      setOnboardingRequired((current) => (current ? false : current));
      setCheckingOnboarding((current) => (current ? false : current));
      return;
    }

    let active = true;
    setCheckingOnboarding((current) => (current ? current : true));
    // A user ID, rather than the Session object, is the dependency. Supabase
    // can replace its Session object during token refresh without changing the
    // account or the first-run onboarding decision.
    void loadCurrentProfile(true)
      .then((profile) => {
        if (active) setOnboardingRequired((current) => current === profile.onboardingRequired ? current : profile.onboardingRequired);
      })
      .catch(() => {
        if (active) setOnboardingRequired((current) => (current ? false : current));
      })
      .finally(() => {
        if (active) setCheckingOnboarding((current) => (current ? false : current));
      });
    return () => { active = false; };
  }, [mfaPending, sessionUserId]);

  useEffect(() => {
    if (!sessionUserId) return;
    const reconcileSafely = () => {
      void reconcileOnAppResume().catch((error) => {
        if (__DEV__)
          console.warn(
            '[Financial reminders] startup reconciliation failed.',
            error instanceof Error ? error.name : 'UnknownError',
          );
      });
    };
    reconcileSafely();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconcileSafely();
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          { eventType?: string; notificationId?: string } | undefined;
        if (data?.notificationId)
          void import('@/services/notifications')
            .then(async ({ fetchNotifications, markNotificationRead }) => {
              await fetchNotifications();
              await markNotificationRead(data.notificationId!);
            })
            .catch(() => undefined);
        if (data?.eventType === 'bill') router.push('/(tabs)/bills');
      },
    );
    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, [router, sessionUserId]);

  useEffect(() => {
    if (checkingSession || checkingOnboarding) return;
    const destination = sessionGateDestination({
      hasSession: Boolean(sessionUserId),
      mfaPending,
      onboardingRequired,
      inTabs: segments[0] === '(tabs)',
      pathname,
    });
    if (!destination) {
      redirectGuard.reset();
      return;
    }
    // Expo Router route groups can share the same URL path. Replacing a
    // logical destination already requested in this state remounts the tab
    // tree, which reruns focus effects and was the request flood's feedback
    // loop. Reset this guard once the route has settled or app state changes.
    const redirectKey = `${sessionUserId ?? 'anonymous'}:${mfaPending}:${onboardingRequired}:${destination}`;
    if (!redirectGuard.shouldRedirect(redirectKey)) return;
    if (destination === '/auth?mode=mfa') router.replace({ pathname: '/auth', params: { mode: 'mfa' } });
    else if (destination === '/auth?mode=signin') router.replace({ pathname: '/auth', params: { mode: 'signin' } });
    else router.replace(destination as Href);
  }, [checkingOnboarding, checkingSession, mfaPending, onboardingRequired, pathname, redirectGuard, router, segments, sessionUserId]);

  if (checkingSession || checkingOnboarding) return <SessionLoadingScreen />;

  return (
    <IncomeWorkflowProvider>
      <DashboardInsightProvider enabled={Boolean(sessionUserId && !mfaPending && !onboardingRequired)}>
        <View
          style={[
            styles.appShell,
            { backgroundColor: colors.background },
            session &&
              modalCount === 0 &&
              !screenOwnsClearance && { paddingBottom: bottomNavClearance },
          ]}
        >
          <Stack screenOptions={stackScreenOptions}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="auth/callback" />
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="wallet-details" options={{ headerShown: false }} />
            <Stack.Screen name="loans" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          {sessionUserId && !mfaPending && !onboardingRequired ? <BottomNav /> : null}
        </View>
      </DashboardInsightProvider>
    </IncomeWorkflowProvider>
  );
}

function SessionLoadingScreen() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.loading, { backgroundColor: colors.background }]}>
      <BrandLockup color={colors.ink} logoSize={36} textSize={26} />
      <ActivityIndicator color={colors.accent} style={styles.spinner} />
      <Text style={[styles.loadingText, { color: colors.muted }]}>Restoring your session…</Text>
    </View>
  );
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
