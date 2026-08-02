import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import { OtpInput } from "../../components/auth/OtpInput";
import alalayLogo from "../../assets/alalay.svg";
import { authCopy, authStats } from "../../constants/auth";
import { getSupabaseClient } from "../../lib/supabase";
import { apiRequest } from "../../lib/apiClient";

type AuthMode = "login" | "register" | "forgot" | "reset";

type AuthPageProps = {
  mode: AuthMode;
};

type AuthValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type LoginStep = "credentials" | "mfa";

type TOTPFactor = {
  id: string;
};

const authSchema = z.object({
  name: z.string(),
  email: z.string(),
  password: z.string(),
  confirmPassword: z.string(),
});

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.79-.07-1.55-.2-2.23H12v4.22h5.37a4.59 4.59 0 0 1-1.99 3.01v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.5Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.89 6.61-2.27l-3.23-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.07v2.58A9.99 9.99 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 14.06A6.02 6.02 0 0 1 6.09 12c0-.71.12-1.4.32-2.06V7.36H3.07A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.07 4.64l3.34-2.58Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.82c1.47 0 2.79.51 3.83 1.5l2.86-2.86C16.95 2.84 14.69 2 12 2a9.99 9.99 0 0 0-8.93 5.36l3.34 2.58C7.2 7.58 9.4 5.82 12 5.82Z"
      />
    </svg>
  );
}

function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <span className={`grid place-items-center overflow-hidden rounded-2xl bg-brand-soft/20 ring-1 ring-white/20 ${className}`}>
      <img src={alalayLogo} alt="" className="h-7 w-7 object-contain" />
    </span>
  );
}

function AuthBrandPanel() {
  return (
    <aside className="hidden h-screen w-[40vw] min-w-[440px] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-dark to-brand-primary p-10 text-white lg:flex">
      <div className="flex items-center gap-3">
        <BrandMark />
        <span className="text-lg font-semibold">Alalay</span>
      </div>

      <div className="max-w-md">
        <h1 className="text-5xl font-bold leading-tight">{authCopy.brandHeadline}</h1>
        <p className="mt-6 text-lg leading-8 text-white/75">{authCopy.brandDescription}</p>
      </div>

      <div className="space-y-7">
        <section className="w-4/5 rounded-[28px] border border-white/15 bg-white/12 p-6 shadow-glow backdrop-blur-md">
          <div className="flex items-center gap-3">
            <BrandMark className="h-9 w-9 rounded-xl" />
            <span className="text-sm font-semibold text-white/90">{authCopy.insightLabel}</span>
          </div>
          <p className="mt-5 leading-7 text-white/85">{authCopy.insightText}</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {authStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-white/10 px-3 py-3 text-center ring-1 ring-white/10">
                <div className="text-sm font-bold">{stat.value}</div>
                <div className="mt-1 text-[11px] leading-tight text-white/65">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

export function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isForgotPassword = mode === "forgot";
  const isResetPassword = mode === "reset";

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [isRecoveryReady, setIsRecoveryReady] = useState(!isResetPassword);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [loginStep, setLoginStep] = useState<LoginStep>("credentials");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactor, setMfaFactor] = useState<TOTPFactor | null>(null);
  const [trustDevice, setTrustDevice] = useState(false);
  const [isMfaStateLoading, setIsMfaStateLoading] = useState(isLogin);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const showingMfaStep = isLogin && loginStep === "mfa";

  const resolverSchema = authSchema.superRefine((values, context) => {
    const addError = (path: [keyof AuthValues], message: string) => {
      context.addIssue({ code: "custom", path, message });
    };

    if (isRegister && values.name.trim().length < 2) addError(["name"], "Name is required");

    if (!isResetPassword) {
      if (!values.email.trim()) addError(["email"], "Email address is required");
      else if (!z.string().email().safeParse(values.email).success) addError(["email"], "Enter a valid email address");
    }

    if (!isForgotPassword) {
      if (!values.password) addError(["password"], "Password is required");
      else if ((isRegister || isResetPassword) && values.password.length < 8) addError(["password"], "Password must be at least 8 characters");
    }

    if (isRegister || isResetPassword) {
      if (!values.confirmPassword) addError(["confirmPassword"], isResetPassword ? "Confirm your new password" : "Confirm your password");
      else if (values.password !== values.confirmPassword) addError(["confirmPassword"], "Passwords do not match");
    }
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthValues>({
    resolver: zodResolver(resolverSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function resolvePendingMfaSession() {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setLoginStep("credentials");
      setMfaFactor(null);
      setIsMfaStateLoading(false);
      return false;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setLoginStep("credentials");
      setMfaFactor(null);
      setIsMfaStateLoading(false);
      return false;
    }

    const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError || aalData?.nextLevel !== "aal2" || aalData.currentLevel === "aal2") {
      setLoginStep("credentials");
      setMfaFactor(null);
      setIsMfaStateLoading(false);
      return false;
    }

    const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();

    if (factorError || !factorData.totp.length) {
      setAuthError("Two-factor authentication is enabled, but no verified authenticator was found.");
      setLoginStep("credentials");
      setMfaFactor(null);
      setIsMfaStateLoading(false);
      return false;
    }

    const factor = factorData.totp[0];
    setMfaFactor({ id: factor.id });
    setTrustDevice(false);
    setLoginStep("mfa");
    setIsMfaStateLoading(false);
    return true;
  }

  useEffect(() => {
    if (!isLogin) {
      return;
    }

    let active = true;

    async function hydrateLoginState() {
      setIsMfaStateLoading(true);
      const resolved = await resolvePendingMfaSession();
      if (!active) return;
      if (!resolved) {
        setLoginStep("credentials");
      }
    }

    void hydrateLoginState();

    return () => {
      active = false;
    };
  }, [isLogin]);

  useEffect(() => {
    if (!isResetPassword) {
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setHasRecoverySession(false);
      setIsRecoveryReady(true);
      return;
    }

    let active = true;

    function syncRecoveryState(sessionExists: boolean) {
      if (!active) return;
      setHasRecoverySession(sessionExists);
      setIsRecoveryReady(true);
    }

    supabase.auth.getSession().then(({ data }) => {
      syncRecoveryState(Boolean(data.session));
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        syncRecoveryState(Boolean(session));
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [isResetPassword]);

  async function handleGoogleAuth() {
    setAuthError("");
    setAuthNotice("");
    const supabase = getSupabaseClient();

    if (!supabase) {
      setAuthError("Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setAuthError(error.message);
    }
  }

  async function handleMfaVerification() {
    setAuthError("");
    setAuthNotice("");

    const supabase = getSupabaseClient();

    if (!supabase || !mfaFactor) {
      setAuthError("Two-factor verification is unavailable right now.");
      return;
    }

    if (!/^\d{6}$/.test(mfaCode)) {
      setAuthError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setIsVerifyingMfa(true);

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactor.id,
        code: mfaCode,
      });

      if (error) {
        throw error;
      }

      if (trustDevice) {
        try {
          await apiRequest<{ trusted: boolean }>("/trusted-device", { method: "POST" });
          setAuthNotice("This device will not ask for a code again for 30 days.");
        } catch {
          setAuthNotice("Verified successfully, but this device could not be remembered.");
        }
      }

      window.location.assign("/app");
    } catch (verifyError) {
      setAuthError(verifyError instanceof Error ? verifyError.message : "Invalid authenticator code.");
    } finally {
      setIsVerifyingMfa(false);
    }
  }

  async function hasTrustedDevice() {
    try {
      const result = await apiRequest<{ trusted: boolean }>("/trusted-device");
      return result.trusted;
    } catch {
      return false;
    }
  }

  async function onSubmit(values: AuthValues) {
    setAuthError("");
    setAuthNotice("");
    const supabase = getSupabaseClient();

    if (!supabase) {
      setAuthError("Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    if (isForgotPassword) {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      setAuthNotice("If that email is registered, we sent a password reset link.");
      return;
    }

    if (isResetPassword) {
      if (!hasRecoverySession) {
        setAuthError("This password reset link is invalid or has expired. Request a new one.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: values.password });

      if (error) {
        setAuthError(error.message);
        return;
      }

      await supabase.auth.signOut();
      setAuthNotice("Password updated. Log in with your new password.");
      window.setTimeout(() => {
        window.location.assign("/login");
      }, 1200);
      return;
    }

    const result = isRegister
      ? await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { data: { name: values.name } },
        })
      : await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

    if (result.error) {
      setAuthError(
        isRegister
          ? result.error.message
          : "Incorrect email or password. If this account was created using Google, sign in with Google, or set a password in Settings after signing in with Google.",
      );
      return;
    }

    if (isRegister && !result.data.session) {
      setAuthNotice("Account created. Check your email to confirm your signup before logging in.");
      return;
    }

    if (isLogin) {
      setIsMfaStateLoading(true);
      if (await hasTrustedDevice()) {
        window.location.assign("/app");
        return;
      }
      const requiresMfa = await resolvePendingMfaSession();
      if (requiresMfa) {
        setMfaCode("");
        return;
      }
    }

    window.location.assign("/app");
  }

  return (
    <main className="min-h-screen bg-app-background text-app-ink lg:flex lg:h-screen lg:overflow-hidden">
      <AuthBrandPanel />

      <section className="flex min-h-screen flex-1 flex-col bg-app-background lg:h-screen">
        <header className="flex items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
          <a
            href={showingMfaStep ? "/login" : "/"}
            className="inline-flex min-h-11 items-center rounded-full px-1 text-sm font-medium text-slate-500 transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <span aria-hidden="true" className="mr-2">&lsaquo;</span>
            {showingMfaStep ? "Back to login" : "Back to home"}
          </a>
          {!showingMfaStep ? <p className="text-sm text-slate-500">
            {isRegister ? "Already joined?" : isLogin ? "New here?" : "Remembered your details?"}{" "}
            <a
              href={isRegister ? "/login" : isLogin ? "/register" : "/login"}
              className="font-semibold text-brand-primary transition hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              {isRegister ? "Log in" : isLogin ? "Create account" : "Log in"}
            </a>
          </p> : null}
        </header>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8 lg:px-12">
          <section className="w-full max-w-[400px]" aria-labelledby="auth-heading">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <BrandMark className="h-11 w-11" />
              <span className="text-lg font-semibold">Alalay</span>
            </div>

            {showingMfaStep ? (
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand-primary" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3 19 6v5c0 4.5-2.8 8.4-7 10-4.2-1.6-7-5.5-7-10V6l7-3Z" />
                  <path d="m9.5 12 1.7 1.7 3.5-3.5" />
                </svg>
              </div>
            ) : null}
            <h1 id="auth-heading" className="text-4xl font-bold text-slate-950">
              {isRegister
                ? "Create account"
                : isForgotPassword
                  ? "Forgot password?"
                  : isResetPassword
                    ? "Set a new password"
                    : showingMfaStep
                      ? "Two-factor verification"
                      : "Welcome back"}
            </h1>
            <p className="mt-3 text-slate-500">
              {isRegister
                ? "Start your Alalay account"
                : isForgotPassword
                  ? "Enter your email and we’ll send a reset link."
                  : isResetPassword
                    ? "Choose a new password for your Alalay account."
                    : showingMfaStep
                      ? <><span className="block">Enter the 6-digit code from your authenticator app.</span><span className="mt-1 block">Open your authenticator app and enter the current code below.</span></>
                      : "Log in to your Alalay account"}
            </p>

            {isLogin && !showingMfaStep ? (
              <>
                <div className="mt-8 grid min-h-11 grid-cols-2 rounded-full bg-slate-100 p-1">
                  <a
                    href="/login"
                    className={`grid min-h-11 place-items-center rounded-full text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-primary ${
                      isLogin ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    Log In
                  </a>
                  <a
                    href="/register"
                    className={`grid min-h-11 place-items-center rounded-full text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-primary ${
                      isRegister ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    Sign Up
                  </a>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>

                <div className="my-7 flex items-center gap-4 text-sm text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  or
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
              </>
            ) : isRegister ? (
              <>
                <div className="mt-8 grid min-h-11 grid-cols-2 rounded-full bg-slate-100 p-1">
                  <a
                    href="/login"
                    className="grid min-h-11 place-items-center rounded-full text-sm font-semibold text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    Log In
                  </a>
                  <a
                    href="/register"
                    className="grid min-h-11 place-items-center rounded-full bg-white text-sm font-semibold text-slate-950 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    Sign Up
                  </a>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>

                <div className="my-7 flex items-center gap-4 text-sm text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  or
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
              </>
            ) : !showingMfaStep ? (
              <div className="mt-8 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">
                {isForgotPassword
                  ? "We’ll send the reset link to your email address."
                  : isResetPassword
                    ? "Open the reset link from your email, then enter your new password here."
                    : null}
              </div>
            ) : null}

            {authError ? (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {authError}
              </div>
            ) : null}
            {authNotice ? (
              <div className="mb-5 rounded-2xl border border-brand-muted bg-brand-soft px-4 py-3 text-sm text-brand-dark" role="status">
                {authNotice}
              </div>
            ) : null}

            {showingMfaStep ? (
              <div className="space-y-5">
                <OtpInput
                  value={mfaCode}
                  onChange={(code) => setMfaCode(code.replace(/\D/g, "").slice(0, 6))}
                  disabled={isVerifyingMfa}
                />
                <Button
                  type="button"
                  className="w-full"
                  isLoading={isVerifyingMfa}
                  onClick={handleMfaVerification}
                  disabled={mfaCode.length !== 6}
                >
                  Verify and log in
                </Button>
                <div className="flex gap-3 rounded-2xl border border-brand-muted bg-brand-soft px-4 py-3 text-sm leading-6 text-brand-dark" role="note">
                  <span aria-hidden="true" className="mt-0.5 shrink-0 font-bold">ⓘ</span>
                  <span>Codes refresh every 30 seconds. Never share your code with anyone — Alalay will never ask for it.</span>
                </div>
                <label htmlFor="trust-device" className="flex items-center gap-3 text-sm font-medium text-slate-600">
                  <input id="trust-device" type="checkbox" checked={trustDevice} onChange={(event) => setTrustDevice(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-primary accent-brand-primary focus:ring-brand-primary" />
                  Trust this device for 30 days
                </label>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
                {isRegister ? (
                  <TextInput
                    id="name"
                    label="Full name"
                    placeholder="Juan Dela Cruz"
                    autoComplete="name"
                    error={errors.name?.message}
                    {...register("name")}
                  />
                ) : null}

                {!isResetPassword ? (
                  <TextInput
                    id="email"
                    label="Email address"
                    type="email"
                    placeholder="juan@email.com"
                    autoComplete="email"
                    error={errors.email?.message}
                    {...register("email")}
                  />
                ) : null}

                {!isForgotPassword ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label htmlFor="password" className="text-sm font-semibold text-slate-800">
                        {isResetPassword ? "New password" : "Password"}
                      </label>
                      {isLogin ? (
                        <a
                          href="/forgot-password"
                          className="text-sm font-semibold text-brand-primary transition hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                          Forgot password?
                        </a>
                      ) : null}
                    </div>
                    <TextInput
                      id="password"
                      label={isResetPassword ? "New password" : "Password"}
                      labelClassName="sr-only"
                      type={showPassword ? "text" : "password"}
                      placeholder={isResetPassword ? "Enter your new password" : "Enter your password"}
                      autoComplete={isRegister || isResetPassword ? "new-password" : "current-password"}
                      error={errors.password?.message}
                      rightSlot={
                        <button
                          type="button"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowPassword((value) => !value)}
                          className="min-h-11 px-1 text-sm font-semibold text-brand-primary transition hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      }
                      {...register("password")}
                    />
                  </div>
                ) : null}

                {isRegister || isResetPassword ? (
                  <TextInput
                    id="confirmPassword"
                    label={isResetPassword ? "Confirm new password" : "Confirm password"}
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={isResetPassword ? "Confirm your new password" : "Confirm your password"}
                    autoComplete="new-password"
                    error={errors.confirmPassword?.message}
                    rightSlot={
                      <button
                        type="button"
                        aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        className="min-h-11 px-1 text-sm font-semibold text-brand-primary transition hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      >
                        {showConfirmPassword ? "Hide" : "Show"}
                      </button>
                    }
                    {...register("confirmPassword")}
                  />
                ) : null}

                {isLogin && isMfaStateLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Checking sign-in status...
                  </div>
                ) : null}

                {isResetPassword && !isRecoveryReady ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Validating your reset link...
                  </div>
                ) : null}

                {isResetPassword && isRecoveryReady && !hasRecoverySession ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    This reset link is invalid or expired.
                    <div className="mt-3">
                      <a
                        href="/forgot-password"
                        className="font-semibold text-brand-primary transition hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      >
                        Request a new reset link
                      </a>
                    </div>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={isSubmitting}
                  disabled={(isResetPassword && (!isRecoveryReady || !hasRecoverySession)) || isMfaStateLoading}
                >
                  {isRegister
                    ? "Create Alalay account"
                    : isForgotPassword
                      ? "Send reset link"
                      : isResetPassword
                        ? "Update password"
                        : "Log in to Alalay"}
                </Button>
              </form>
            )}
          </section>
        </div>
      </section>

      <button
        type="button"
        aria-label="Open help"
        className="fixed bottom-5 right-5 z-10 grid h-12 w-12 place-items-center rounded-full bg-slate-950 text-lg font-semibold text-white shadow-lg transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
      >
        ?
      </button>
    </main>
  );
}
