import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import alalayLogo from "../../assets/alalay.svg";
import { authCopy, authStats } from "../../constants/auth";
import { getSupabaseClient } from "../../lib/supabase";
import { Button } from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";

type AuthMode = "login" | "register";

type AuthPageProps = {
  mode: AuthMode;
};

const loginSchema = z.object({
  email: z.string().min(1, "Email address is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2, "Name is required"),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;
type AuthValues = LoginValues | RegisterValues;

function isRegisterValues(values: AuthValues): values is RegisterValues {
  return "name" in values;
}

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
  const isRegister = mode === "register";
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthValues>({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema),
    defaultValues: isRegister ? { name: "", email: "", password: "" } : { email: "", password: "" },
  });

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
      options: { redirectTo: `${window.location.origin}/app` },
    });

    if (error) {
      setAuthError(error.message);
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

    const result = isRegisterValues(values)
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
      setAuthError(isRegister ? result.error.message : "Incorrect email or password");
      return;
    }

    if (isRegister && !result.data.session) {
      setAuthNotice("Account created. Check your email to confirm your signup before logging in.");
      return;
    }

    window.location.assign("/app");
  }

  return (
    <main className="min-h-screen bg-app-background text-app-ink lg:flex lg:h-screen lg:overflow-hidden">
      <AuthBrandPanel />

      <section className="flex min-h-screen flex-1 flex-col bg-app-background lg:h-screen">
        <header className="flex items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
          <a
            href="/"
            className="inline-flex min-h-11 items-center rounded-full px-1 text-sm font-medium text-slate-500 transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <span aria-hidden="true" className="mr-2">‹</span>
            Back to home
          </a>
          <p className="text-sm text-slate-500">
            {isRegister ? "Already joined?" : "New here?"}{" "}
            <a
              href={isRegister ? "/login" : "/register"}
              className="font-semibold text-brand-primary transition hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              {isRegister ? "Log in" : "Create account"}
            </a>
          </p>
        </header>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8 lg:px-12">
          <section className="w-full max-w-[400px]" aria-labelledby="auth-heading">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <BrandMark className="h-11 w-11" />
              <span className="text-lg font-semibold">Alalay</span>
            </div>

            <h1 id="auth-heading" className="text-4xl font-bold text-slate-950">
              {isRegister ? "Create account" : "Welcome back"}
            </h1>
            <p className="mt-3 text-slate-500">
              {isRegister ? "Start your Alalay account" : "Log in to your Alalay account"}
            </p>

            <div className="mt-8 grid min-h-11 grid-cols-2 rounded-full bg-slate-100 p-1">
              <a
                href="/login"
                className={`grid min-h-11 place-items-center rounded-full text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-primary ${
                  !isRegister ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
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

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              {isRegister ? (
                <TextInput
                  id="name"
                  label="Full name"
                  placeholder="Juan Dela Cruz"
                  autoComplete="name"
                  error={isRegister && "name" in errors ? errors.name?.message : undefined}
                  {...register("name")}
                />
              ) : null}

              <TextInput
                id="email"
                label="Email address"
                type="email"
                placeholder="juan@email.com"
                autoComplete="email"
                error={errors.email?.message}
                {...register("email")}
              />

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-semibold text-slate-800">
                    Password
                  </label>
                  <a
                    href="/forgot-password"
                    className="text-sm font-semibold text-brand-primary transition hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    Forgot password?
                  </a>
                </div>
                <TextInput
                  id="password"
                  label="Password"
                  labelClassName="sr-only"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
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

              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                {isRegister ? "Create Alalay account" : "Log in to Alalay"}
              </Button>
            </form>
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
