import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { AppPreferencesProvider } from './context/AppPreferencesContext';
import { ProfileProvider } from './context/ProfileContext';
import { getSupabaseClient } from './lib/supabase';
import { apiRequest } from './lib/apiClient';
import { AuthPage } from './pages/auth/AuthPage';
import { AiAssistantPage } from './pages/dashboard/AiAssistantPage';
import { BillsPage } from './pages/dashboard/BillsPage';
import { BudgetPage } from './pages/dashboard/BudgetPage';
import { ExpensesPage } from './pages/dashboard/ExpensesPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { IncomePage } from './pages/dashboard/IncomePage';
import { OcrScannerPage } from './pages/dashboard/OcrScannerPage';
import { ReportsPage } from './pages/dashboard/ReportsPage';
import { SavingsGoalsPage } from './pages/dashboard/SavingsGoalsPage';
import { SettingsPage } from './pages/dashboard/SettingsPage';
import { SubscriptionsPage } from './pages/dashboard/SubscriptionsPage';
import { WalletsPage } from './pages/dashboard/WalletsPage';
import { WalletDetailsPage } from './pages/dashboard/WalletDetailsPage';
import { HomePage } from './pages/home/HomePage';
import { ContactPage } from './pages/public/ContactPage';
import { PrivacyPage } from './pages/public/PrivacyPage';

function AppLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-app-background text-slate-600">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        Loading Alalay...
      </div>
    </main>
  );
}

function getOAuthCallbackError() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const error = searchParams.get('error') || hashParams.get('error');
  const description = searchParams.get('error_description') || hashParams.get('error_description');

  if (!error && !description) return '';
  if (error === 'access_denied' || description?.toLowerCase().includes('cancel')) {
    return "Google sign-in was cancelled. You can try again whenever you're ready.";
  }
  return description || 'Google sign-in could not be completed. Please try again.';
}

function OAuthCallbackError({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-app-background px-5 text-app-ink">
      <section className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-950">Unable to sign you in</h1>
        <p className="mt-3 text-slate-500">{message}</p>
        <a
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-brand-primary px-6 py-3 font-semibold text-white transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
        >
          Back to login
        </a>
      </section>
    </main>
  );
}

function AppContent() {
  const pathname = window.location.pathname;
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isMfaPending, setIsMfaPending] = useState(false);
  const supabase = getSupabaseClient();

  useEffect(() => {
    const supabaseClient = supabase;
    if (!supabaseClient) {
      setIsMfaPending(false);
      setIsSessionLoading(false);
      return;
    }

    let isMounted = true;

    async function syncAuthState(nextSession: Session | null) {
      if (!isMounted) return;
      if (!supabaseClient) return;

      setSession(nextSession);

      if (!nextSession) {
        setIsMfaPending(false);
        setIsSessionLoading(false);
        return;
      }

      const { data, error } = await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();

      if (!isMounted) return;

      let pendingSecondFactor =
        !error && data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2';

      if (pendingSecondFactor) {
        try {
          const trustedDevice = await apiRequest<{ trusted: boolean }>('/trusted-device');
          if (trustedDevice.trusted) {
            pendingSecondFactor = false;
          }
        } catch {
          // A failed trusted-device lookup must fail closed and keep MFA required.
        }
      }

      setIsMfaPending(Boolean(pendingSecondFactor));
      setIsSessionLoading(false);
    }

      supabaseClient.auth.getSession().then(({ data }) => {
      void syncAuthState(data.session);
    });

      const { data } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      void syncAuthState(nextSession);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  if (pathname === '/privacy') return <PrivacyPage />;
  if (pathname === '/contact') return <ContactPage />;

  async function handleSignOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    window.location.assign('/login');
  }

  if (pathname === '/login') {
    if (isSessionLoading) {
      return <AppLoading />;
    }

    if (session && !isMfaPending) {
      window.location.replace('/app');
      return <AppLoading />;
    }

    return <AuthPage mode="login" />;
  }

  if (pathname === '/auth/callback') {
    const callbackError = getOAuthCallbackError();

    if (isSessionLoading) {
      return <AppLoading />;
    }

    if (callbackError) {
      return <OAuthCallbackError message={callbackError} />;
    }

    if (session) {
      window.location.replace('/app');
      return <AppLoading />;
    }

    return (
      <OAuthCallbackError message="Google sign-in did not return an active session. Please try again." />
    );
  }

  if (pathname === '/register') {
    if (isSessionLoading) {
      return <AppLoading />;
    }

    if (session) {
      window.location.replace('/app');
      return <AppLoading />;
    }

    return <AuthPage mode="register" />;
  }

  if (pathname === '/forgot-password') {
    if (isSessionLoading) {
      return <AppLoading />;
    }

    if (session && !isMfaPending) {
      window.location.replace('/app');
      return <AppLoading />;
    }

    return <AuthPage mode="forgot" />;
  }

  if (pathname === '/reset-password') {
    if (isSessionLoading) {
      return <AppLoading />;
    }

    return <AuthPage mode="reset" />;
  }

  if (pathname === '/app') {
    if (isSessionLoading) {
      return <AppLoading />;
    }

    if (!session || isMfaPending) {
      window.location.replace('/login');
      return <AppLoading />;
    }

    return <DashboardPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === '/app/bills') {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace('/login');
      return <AppLoading />;
    }
    return <BillsPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === '/app/subscriptions') {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace('/login');
      return <AppLoading />;
    }
    return <SubscriptionsPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === '/app/expenses') {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace('/login');
      return <AppLoading />;
    }
    return <ExpensesPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === '/app/income') {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace('/login');
      return <AppLoading />;
    }
    return <IncomePage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === '/app/savings-goals' || pathname === '/app/goals') {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace('/login');
      return <AppLoading />;
    }
    return <SavingsGoalsPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === '/app/wallets') {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace('/login');
      return <AppLoading />;
    }
    return <WalletsPage session={session} onSignOut={handleSignOut} />;
  }

  const walletDetailsMatch = pathname.match(/^\/app\/wallets\/([^/]+)\/?$/);
  if (walletDetailsMatch) {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace('/login');
      return <AppLoading />;
    }
    return (
      <WalletDetailsPage
        session={session}
        onSignOut={handleSignOut}
        walletId={decodeURIComponent(walletDetailsMatch[1])}
      />
    );
  }

  if (pathname === '/app/history') {
    window.location.replace('/app/expenses');
    return <AppLoading />;
  }

  if (pathname === '/app/budget') {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace('/login');
      return <AppLoading />;
    }
    return <BudgetPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === '/app/reports') {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace('/login');
      return <AppLoading />;
    }
    return <ReportsPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === '/app/ai-assistant') {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace('/login');
      return <AppLoading />;
    }
    return <AiAssistantPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === '/app/ocr-scanner') {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace('/login');
      return <AppLoading />;
    }
    return <OcrScannerPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === '/app/settings/plan') {
    window.location.replace('/app/settings');
    return <AppLoading />;
  }

  if (pathname === '/app/settings') {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace('/login');
      return <AppLoading />;
    }
    return <SettingsPage session={session} onSignOut={handleSignOut} />;
  }

  return <HomePage />;
}

export default function App() {
  return (
    <AppPreferencesProvider>
      <ProfileProvider>
        <AppContent />
      </ProfileProvider>
    </AppPreferencesProvider>
  );
}
