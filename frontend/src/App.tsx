import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "./lib/supabase";
import { AuthPage } from "./pages/auth/AuthPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
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

export default function App() {
  const pathname = window.location.pathname;
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!supabase) {
      setIsSessionLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session);
        setIsSessionLoading(false);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
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

    if (session) {
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

  if (pathname === "/app") {
    if (isSessionLoading) {
      return <AppLoading />;
    }

    if (!session) {
      window.location.replace("/login");
      return <AppLoading />;
    }

    return <DashboardPage session={session} onSignOut={handleSignOut} />;
  }

  return <HomePage />;
}
