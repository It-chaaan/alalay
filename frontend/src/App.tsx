import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { AppPreferencesProvider } from "./context/AppPreferencesContext";
import { getSupabaseClient } from "./lib/supabase";
import { AuthPage } from "./pages/auth/AuthPage";
import { AiAssistantPage } from "./pages/dashboard/AiAssistantPage";
import { BillsPage } from "./pages/dashboard/BillsPage";
import { BudgetPage } from "./pages/dashboard/BudgetPage";
import { ExpensesPage } from "./pages/dashboard/ExpensesPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { IncomePage } from "./pages/dashboard/IncomePage";
import { OcrScannerPage } from "./pages/dashboard/OcrScannerPage";
import { ReportsPage } from "./pages/dashboard/ReportsPage";
import { SavingsGoalsPage } from "./pages/dashboard/SavingsGoalsPage";
import { SettingsPage } from "./pages/dashboard/SettingsPage";
import { SubscriptionsPage } from "./pages/dashboard/SubscriptionsPage";
import { HomePage } from "./pages/home/HomePage";

function AppLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-app-background text-slate-600">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        Loading Alalay...
      </div>
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
    if (!supabase) {
      setIsMfaPending(false);
      setIsSessionLoading(false);
      return;
    }

    let isMounted = true;

    async function syncAuthState(nextSession: Session | null) {
      if (!isMounted) return;

      setSession(nextSession);

      if (!nextSession) {
        setIsMfaPending(false);
        setIsSessionLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (!isMounted) return;

      const pendingSecondFactor = !error && data?.nextLevel === "aal2" && data.currentLevel !== "aal2";

      setIsMfaPending(Boolean(pendingSecondFactor));
      setIsSessionLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      void syncAuthState(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncAuthState(nextSession);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    window.location.assign("/login");
  }

  if (pathname === "/login") {
    if (isSessionLoading) {
      return <AppLoading />;
    }

    if (session && !isMfaPending) {
      window.location.replace("/app");
      return <AppLoading />;
    }

    return <AuthPage mode="login" />;
  }

  if (pathname === "/register") {
    if (isSessionLoading) {
      return <AppLoading />;
    }

    if (session) {
      window.location.replace("/app");
      return <AppLoading />;
    }

    return <AuthPage mode="register" />;
  }

  if (pathname === "/forgot-password") {
    if (isSessionLoading) {
      return <AppLoading />;
    }

    if (session && !isMfaPending) {
      window.location.replace("/app");
      return <AppLoading />;
    }

    return <AuthPage mode="forgot" />;
  }

  if (pathname === "/reset-password") {
    if (isSessionLoading) {
      return <AppLoading />;
    }

    return <AuthPage mode="reset" />;
  }

  if (pathname === "/app") {
    if (isSessionLoading) {
      return <AppLoading />;
    }

    if (!session || isMfaPending) {
      window.location.replace("/login");
      return <AppLoading />;
    }

    return <DashboardPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === "/app/bills") {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace("/login");
      return <AppLoading />;
    }
    return <BillsPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === "/app/subscriptions") {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace("/login");
      return <AppLoading />;
    }
    return <SubscriptionsPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === "/app/expenses") {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace("/login");
      return <AppLoading />;
    }
    return <ExpensesPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === "/app/income") {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace("/login");
      return <AppLoading />;
    }
    return <IncomePage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === "/app/savings-goals") {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace("/login");
      return <AppLoading />;
    }
    return <SavingsGoalsPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === "/app/budget") {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace("/login");
      return <AppLoading />;
    }
    return <BudgetPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === "/app/reports") {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace("/login");
      return <AppLoading />;
    }
    return <ReportsPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === "/app/ai-assistant") {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace("/login");
      return <AppLoading />;
    }
    return <AiAssistantPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === "/app/ocr-scanner") {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace("/login");
      return <AppLoading />;
    }
    return <OcrScannerPage session={session} onSignOut={handleSignOut} />;
  }

  if (pathname === "/app/settings/plan") {
    window.location.replace("/app/settings");
    return <AppLoading />;
  }

  if (pathname === "/app/settings") {
    if (isSessionLoading) return <AppLoading />;
    if (!session || isMfaPending) {
      window.location.replace("/login");
      return <AppLoading />;
    }
    return <SettingsPage session={session} onSignOut={handleSignOut} />;
  }

  return <HomePage />;
}

export default function App() {
  return (
    <AppPreferencesProvider>
      <AppContent />
    </AppPreferencesProvider>
  );
}
