import * as React from "react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "../../hooks/types";
import { Check, ChevronDown, ChevronUp, ImagePlus, Plus, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { getSupabaseClient } from "../../lib/supabase";
import { apiRequest } from "../../lib/apiClient";
import { createCategoryId, readAppSettings, writeAppSettings, type AppCategory, type AppSettings, type CategoryKind, type CurrencyCode, type DateFormat, type ThemeMode } from "../../lib/appSettings";
import { useProfile } from "../../context/ProfileContext";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { uploadProfileAvatar } from "../../lib/profileAvatar";
import { SettingsSkeleton } from "../../components/ui/Skeleton";

const settingsTabs = ["Profile", "Preferences", "Notifications", "Security"] as const;
type SettingsTab = (typeof settingsTabs)[number] | "Categories";

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

function profileStorageKey(userId: string) {
  return `alalay-profile:${userId}`;
}

function userHasPassword(user: User | null) {
  if (!user) return false;
  const providers = user.app_metadata?.providers;
  const hasEmailIdentity = user.identities?.some((identity) => identity.provider === "email");
  return Boolean(hasEmailIdentity || providers?.includes("email") || user.user_metadata?.password_set === true);
}

function readLocalProfile(userId: string) {
  try { return JSON.parse(window.localStorage.getItem(profileStorageKey(userId)) || "{}"); } catch { return {}; }
}

function Field({ label, value, onChange, type = "text", error, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; error?: string; placeholder?: string }) {
  const readOnly = label === "Email address";
  return <label className="block"><span className="text-xs font-semibold text-slate-950">{label}{readOnly ? " (managed by your sign-in provider)" : ""}</span><input type={type} value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`mt-2 h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 ${readOnly ? "bg-slate-50 text-slate-500" : ""} ${error ? "border-red-300" : "border-slate-200"}`} />{error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}</label>;
}

function SaveButton({ children, disabled, saving }: { children: string; disabled: boolean; saving: boolean }) {
  return <button type="submit" disabled={disabled || saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50">{saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}{saving ? "Saving..." : children}</button>;
}

function Toast({ message, error, onClose }: { message: string; error?: boolean; onClose: () => void }) {
  return <div role="status" className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${error ? "bg-red-600" : "bg-brand-dark"}`}>{error ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}{message}<button type="button" onClick={onClose} aria-label="Dismiss notification"><X className="h-4 w-4 opacity-70" /></button></div>;
}

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="rounded-[14px] border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-base font-semibold text-slate-950">{title}</h2>{description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}</div>{children}</section>;
}

function ProfileTab({ session, onSaved, notify }: { session: Session; onSaved: (name: string) => void; notify: (message: string, error?: boolean) => void }) {
  const { profile, isLoading, updateProfile } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const initialName = profile?.name || getDisplayName(session);
  const initialEmail = profile?.email || session.user.email || "";
  const localProfile = readLocalProfile(session.user.id);
  const [form, setForm] = useState({ name: initialName, email: initialEmail, phone: profile?.phone || localProfile.phone || "", language: (profile?.language || "en") as "en" | "fil", avatar: profile?.avatar_url || "" });
  const [saved, setSaved] = useState(form);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      const local = readLocalProfile(session.user.id);
      const next = { name: profile.name || getDisplayName(session), email: profile.email || session.user.email || "", phone: profile.phone || local.phone || "", language: profile.language || "en", avatar: profile.avatar_url || "" };
      setForm(next); setSaved(next);
    }
  }, [profile, session]);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  function update(key: keyof typeof form, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  function selectPhoto(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return notify("Choose an image file.", true);
    setAvatarFile(file);
    const reader = new FileReader(); reader.onload = () => update("avatar", String(reader.result)); reader.readAsDataURL(file);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Full name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Enter a valid email address.";
    if (form.phone && !/^(?:\+63|09)\s?9\d{2}\s?\d{3}\s?\d{4}$/.test(form.phone.replace(/-/g, " "))) nextErrors.phone = "Use a Philippine mobile number, such as +63 912 345 6789.";
    setErrors(nextErrors); if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const avatarUrl = avatarFile ? await uploadProfileAvatar(session.user.id, avatarFile) : form.avatar || null;
      const savedProfile = await apiRequest<Profile>("/users/me", { method: "PATCH", body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), phone: form.phone || null, language: form.language, avatar_url: avatarUrl }) });
      window.localStorage.setItem(profileStorageKey(session.user.id), JSON.stringify({ phone: form.phone }));
      updateProfile(savedProfile);
      const nextForm = { ...form, avatar: savedProfile.avatar_url || avatarUrl || "" };
      setForm(nextForm); setSaved(nextForm); setAvatarFile(null); onSaved(form.name.trim()); notify("Profile updated");
    } catch (saveError) { notify(saveError instanceof Error ? saveError.message : "Unable to update profile.", true); } finally { setSaving(false); }
  }

  return <Card title="Profile" description="Manage your personal information and account identity."><form onSubmit={submit} className="space-y-5">{isLoading && !profile ? <SettingsSkeleton /> : null}{!isLoading || profile ? <><div className="flex items-center gap-4"><div className="relative"><UserAvatar url={form.avatar} name={form.name} size="large" alt="Profile avatar" /><button type="button" onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-brand-primary text-white" aria-label="Change photo"><ImagePlus className="h-3.5 w-3.5" /></button><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => selectPhoto(event.target.files?.[0])} /></div><div><p className="font-semibold text-slate-950">{form.name}</p><p className="text-sm text-slate-500">{form.email}</p><button type="button" onClick={() => fileRef.current?.click()} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary"><Upload className="h-3 w-3" />Change photo</button></div></div><div className="grid gap-4 md:grid-cols-2"><Field label="Full name" value={form.name} onChange={(value) => update("name", value)} error={errors.name} /><Field label="Email address" value={form.email} onChange={(value) => update("email", value)} type="email" error={errors.email} /><Field label="Phone number" value={form.phone} onChange={(value) => update("phone", value)} type="tel" placeholder="+63 912 345 6789" error={errors.phone} /></div><fieldset><legend className="text-xs font-semibold text-slate-950">Language</legend><div className="mt-2 inline-flex rounded-xl border border-slate-200 p-1">{([["en", "English"], ["fil", "Filipino"]] as const).map(([value, label]) => <label key={value} className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm ${form.language === value ? "bg-brand-muted font-semibold text-brand-primary" : "text-slate-500"}`}><input type="radio" className="sr-only" checked={form.language === value} onChange={() => update("language", value)} />{label}</label>)}</div></fieldset><div><SaveButton disabled={!dirty} saving={saving}>Save changes</SaveButton></div></> : null}</form></Card>;
}

function PreferencesTab({ notify }: { notify: (message: string, error?: boolean) => void }) {
  const [settings, setSettings] = useState(() => readAppSettings()); const [saved, setSaved] = useState(settings); const [saving, setSaving] = useState(false); const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); await new Promise((resolve) => window.setTimeout(resolve, 250)); writeAppSettings(settings); setSaved(settings); setSaving(false); notify("Preferences saved"); }
  return <Card title="Preferences" description="Personalize the way Alalay looks and displays your finances."><form onSubmit={submit} className="space-y-6"><SettingChoice label="Theme" value={settings.theme} options={[["light", "Light"], ["dark", "Dark"], ["system", "System"]]} onChange={(value) => setSettings({ ...settings, theme: value as ThemeMode })} /><div className="grid gap-4 md:grid-cols-2"><Select label="Currency" value={settings.currency} options={[["PHP", "PHP - Philippine peso"], ["USD", "USD - US dollar"], ["EUR", "EUR - Euro"], ["JPY", "JPY - Japanese yen"], ["SGD", "SGD - Singapore dollar"]]} onChange={(value) => setSettings({ ...settings, currency: value as CurrencyCode })} /><Select label="Date format" value={settings.dateFormat} options={[["short", "Jun 28, 2025"], ["slash", "28/06/2025"], ["iso", "2025-06-28"]]} onChange={(value) => setSettings({ ...settings, dateFormat: value as DateFormat })} /></div><SaveButton disabled={!dirty} saving={saving}>Save preferences</SaveButton></form></Card>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-semibold text-slate-950">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20">{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>; }
function SettingChoice({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) { return <fieldset><legend className="text-xs font-semibold text-slate-950">{label}</legend><div className="mt-2 flex flex-wrap gap-2">{options.map(([option, text]) => <label key={option} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${value === option ? "border-brand-primary bg-brand-muted font-semibold text-brand-primary" : "border-slate-200 text-slate-600"}`}><input type="radio" className="sr-only" checked={value === option} onChange={() => onChange(option)} />{text}</label>)}</div></fieldset>; }

const notificationItems: Array<[keyof AppSettings["notifications"], string, string]> = [["billReminders", "Bill due reminders", "Email reminders before an upcoming bill is due."], ["overspendingAlerts", "Low balance / overspending alerts", "Be notified when spending needs attention."], ["budgetThresholds", "Budget threshold reached", "Alert at 80% and 100% of a category budget."], ["subscriptionReminders", "Subscription renewal reminders", "Email + in-app reminders when a recurring subscription is about to renew."], ["summaries", "Weekly/monthly summary ready", "Receive a monthly email summary of your activity."], ["savingsMilestones", "Savings goal milestones", "Celebrate progress toward savings goals."], ["loginAlerts", "New device login alerts", "Notify when your account is used on a new device."]];

type ApiNotificationPreferences = { user_id: string; bill_reminders: boolean; bill_reminder_days: number; subscription_reminders: boolean; summaries: boolean; overspending_alerts: boolean; budget_thresholds: boolean; savings_milestones: boolean; login_alerts: boolean };
function toLocalNotifications(value: ApiNotificationPreferences): AppSettings["notifications"] { return { billReminders: value.bill_reminders, billReminderDays: value.bill_reminder_days, subscriptionReminders: value.subscription_reminders, summaries: value.summaries, overspendingAlerts: value.overspending_alerts, budgetThresholds: value.budget_thresholds, savingsMilestones: value.savings_milestones, loginAlerts: value.login_alerts }; }
function toApiNotifications(value: AppSettings["notifications"]) { return { bill_reminders: value.billReminders, bill_reminder_days: value.billReminderDays, subscription_reminders: value.subscriptionReminders, summaries: value.summaries, overspending_alerts: value.overspendingAlerts, budget_thresholds: value.budgetThresholds, savings_milestones: value.savingsMilestones, login_alerts: value.loginAlerts }; }
function NotificationsTab({ notify }: { notify: (message: string, error?: boolean) => void }) {
  const initial = readAppSettings();
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const dirty = JSON.stringify(settings.notifications) !== JSON.stringify(saved.notifications);

  useEffect(() => {
    let active = true;
    const legacy = window.localStorage.getItem("alalay-app-settings");
    apiRequest<ApiNotificationPreferences>("/users/me/notification-preferences")
      .then(async (remote) => {
        let next = toLocalNotifications(remote);
        if (legacy) {
          const legacySettings = readAppSettings();
          await apiRequest("/users/me/notification-preferences", { method: "PATCH", body: JSON.stringify(toApiNotifications(legacySettings.notifications)) });
          next = legacySettings.notifications;
          window.localStorage.removeItem("alalay-app-settings");
        }
        if (active) { setSettings((current) => ({ ...current, notifications: next })); setSaved((current) => ({ ...current, notifications: next })); }
      })
      .catch(() => { if (active) notify("Unable to load notification preferences; using saved local settings.", true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [notify]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      await apiRequest("/users/me/notification-preferences", { method: "PATCH", body: JSON.stringify(toApiNotifications(settings.notifications)) });
      window.localStorage.removeItem("alalay-app-settings"); setSaved(settings); notify("Notification settings saved");
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to save notification settings.", true); }
    finally { setSaving(false); }
  }

  return <Card title="Notifications" description="Choose which email and in-app reminders you want to receive."><form onSubmit={submit} className="space-y-2">{loading ? <SettingsSkeleton /> : null}{!loading ? notificationItems.map(([key, label, description]) => <div key={key} className="flex items-center gap-4 border-b border-slate-100 py-3 last:border-0"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-950">{label}</p><p className="mt-0.5 text-xs text-slate-500">{description}</p>{key === "billReminders" && settings.notifications.billReminders ? <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">Remind me <input type="number" min="0" max="30" value={settings.notifications.billReminderDays} onChange={(event) => setSettings({ ...settings, notifications: { ...settings.notifications, billReminderDays: Number(event.target.value) } })} className="h-8 w-16 rounded-lg border border-slate-200 px-2" /> days before</label> : null}</div><button type="button" role="switch" aria-checked={settings.notifications[key]} onClick={() => setSettings({ ...settings, notifications: { ...settings.notifications, [key]: !settings.notifications[key] } })} className={`relative h-6 w-11 shrink-0 rounded-full transition ${settings.notifications[key] ? "bg-brand-primary" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${settings.notifications[key] ? "left-6" : "left-1"}`} /></button></div>) : null}<div className="pt-4"><SaveButton disabled={!dirty || loading} saving={saving}>Save notifications</SaveButton></div></form></Card>;
}

function SecurityTab({ notify }: { notify: (message: string, error?: boolean) => void }) {
  const supabase = getSupabaseClient();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [verifiedFactor, setVerifiedFactor] = useState<{ id: string; friendlyName?: string } | null>(null);
  const [currentAal, setCurrentAal] = useState<string | null>(null);
  const [loadingTwoFactor, setLoadingTwoFactor] = useState(true);
  const [enablingTwoFactor, setEnablingTwoFactor] = useState(false);
  const [verifyingTwoFactor, setVerifyingTwoFactor] = useState(false);
  const [disablingTwoFactor, setDisablingTwoFactor] = useState(false);
  const [code, setCode] = useState("");

  async function loadPasswordState() {
    if (!supabase) {
      setHasPassword(null);
      return;
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      setHasPassword(null);
      return;
    }
    setHasPassword(userHasPassword(data.user));
  }

  useEffect(() => {
    void loadPasswordState();
  }, []);

  async function loadTwoFactorState() {
    if (!supabase) {
      setVerifiedFactor(null);
      setCurrentAal(null);
      setLoadingTwoFactor(false);
      return;
    }

    setLoadingTwoFactor(true);

    try {
      const [{ data: factorData, error: factorError }, { data: aalData, error: aalError }] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

      if (factorError) throw factorError;
      if (aalError) throw aalError;

      const existingFactor = factorData.totp[0];

      setVerifiedFactor(
        existingFactor
          ? {
              id: existingFactor.id,
              friendlyName: existingFactor.friendly_name,
            }
          : null,
      );
      setCurrentAal(aalData.currentLevel);
    } catch (factorStateError) {
      notify(factorStateError instanceof Error ? factorStateError.message : "Unable to load two-factor settings.", true);
    } finally {
      setLoadingTwoFactor(false);
    }
  }

  useEffect(() => {
    void loadTwoFactorState();
  }, []);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    const nextErrors: string[] = [];
    if (hasPassword === null) nextErrors.push("Unable to determine your password settings. Try again.");
    if (hasPassword && !form.current) nextErrors.push("Enter your current password.");
    if (form.next.length < 8 || !/\d/.test(form.next)) nextErrors.push("New password must be at least 8 characters and contain a number.");
    if (form.next !== form.confirm) nextErrors.push("Passwords do not match.");
    setErrors(nextErrors);
    if (nextErrors.length || !supabase) return;
    setSaving(true);
    try {
      if (hasPassword) {
        const email = (await supabase.auth.getUser()).data.user?.email;
        if (!email) throw new Error("Unable to verify your account.");
        const check = await supabase.auth.signInWithPassword({ email, password: form.current });
        if (check.error) throw check.error;
      }
      const currentMetadata = (await supabase.auth.getUser()).data.user?.user_metadata || {};
      const result = await supabase.auth.updateUser({
        password: form.next,
        data: { ...currentMetadata, password_set: true },
      });
      if (result.error) throw result.error;
      await supabase.auth.refreshSession();
      const refreshedUser = (await supabase.auth.getUser()).data.user;
      setHasPassword(userHasPassword(refreshedUser) || Boolean(refreshedUser?.user_metadata?.password_set));
      setForm({ current: "", next: "", confirm: "" });
      notify(hasPassword ? "Password changed" : "Password set");
    } catch (changeError) {
      const message = changeError instanceof Error ? changeError.message : "Unable to change password.";
      setErrors([message]);
      notify(message, true);
    } finally {
      setSaving(false);
    }
  }

  async function beginTwoFactor() {
    if (!supabase) return notify("Authenticator setup is unavailable.", true);
    setEnablingTwoFactor(true);
    try {
      const result = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Alalay authenticator" });
      if (result.error || !result.data) throw result.error || new Error("Unable to start authenticator setup.");
      setFactor({ id: result.data.id, qr: result.data.totp.qr_code, secret: result.data.totp.secret });
      setCode("");
    } catch (factorError) {
      notify(factorError instanceof Error ? factorError.message : "Unable to start authenticator setup.", true);
    } finally {
      setEnablingTwoFactor(false);
    }
  }

  async function verifyTwoFactor() {
    if (!supabase || !factor || !/^\d{6}$/.test(code)) return;
    setVerifyingTwoFactor(true);
    try {
      const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (verified.error) throw verified.error;
      setFactor(null);
      setCode("");
      await loadTwoFactorState();
      notify("Authenticator enabled");
    } catch (verifyError) {
      notify(verifyError instanceof Error ? verifyError.message : "Invalid authenticator code.", true);
    } finally {
      setVerifyingTwoFactor(false);
    }
  }

  async function disableTwoFactor() {
    if (!supabase || !verifiedFactor) return;
    setDisablingTwoFactor(true);
    try {
      const result = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
      if (result.error) throw result.error;
      setFactor(null);
      setCode("");
      await loadTwoFactorState();
      notify("Authenticator disabled");
    } catch (disableError) {
      notify(disableError instanceof Error ? disableError.message : "Unable to disable two-factor authentication.", true);
    } finally {
      setDisablingTwoFactor(false);
    }
  }

  const twoFactorEnabled = Boolean(verifiedFactor);
  const canDisableTwoFactor = twoFactorEnabled && currentAal === "aal2";
  const passwordOnly = hasPassword === false;

  return <div className="space-y-5"><Card title={passwordOnly ? "Set a password" : "Change password"} description={passwordOnly ? "You signed in with Google. Set a password to also enable email/password login for this account." : "Use a strong password that you do not reuse elsewhere."}><form onSubmit={changePassword} className="max-w-xl space-y-4">{errors.map((message) => <p key={message} className="text-xs text-red-600">{message}</p>)}{!passwordOnly ? <Field label="Current password" value={form.current} onChange={(value) => setForm({ ...form, current: value })} type="password" /> : null}<Field label="New password" value={form.next} onChange={(value) => setForm({ ...form, next: value })} type="password" /><Field label="Confirm new password" value={form.confirm} onChange={(value) => setForm({ ...form, confirm: value })} type="password" /><SaveButton disabled={(!passwordOnly && !form.current) || !form.next || !form.confirm || hasPassword === null} saving={saving}>{passwordOnly ? "Set password" : "Change password"}</SaveButton></form></Card><Card title="Authenticator app" description="Add a second factor to protect access to your financial data."><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-muted text-brand-primary"><ShieldCheck className="h-5 w-5" /></span><div className="flex-1"><p className="text-sm font-semibold text-slate-950">Two-factor authentication</p><p className="mt-1 text-xs text-slate-500">{loadingTwoFactor ? "Checking your authenticator status..." : twoFactorEnabled ? "Your account requires a 6-digit authenticator code at sign-in." : "Use an authenticator app to generate sign-in codes."}</p>{twoFactorEnabled && verifiedFactor?.friendlyName ? <p className="mt-2 text-xs text-slate-500">Connected app: {verifiedFactor.friendlyName}</p> : null}</div>{loadingTwoFactor ? <span className="text-xs font-semibold text-slate-400">Loading</span> : twoFactorEnabled ? <span className="text-xs font-semibold text-brand-primary">Enabled</span> : <button type="button" onClick={beginTwoFactor} disabled={enablingTwoFactor} className="rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{enablingTwoFactor ? "Starting..." : "Enable"}</button>}</div>{factor ? <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold">Scan this QR code</p>{factor.qr ? <img src={factor.qr} alt="Authenticator QR code" className="mt-3 h-40 w-40 rounded bg-white p-2" /> : null}<p className="mt-3 text-xs text-slate-500">Manual key: <code className="select-all font-mono text-slate-800">{factor.secret}</code></p><div className="mt-3 flex gap-2"><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" className="h-9 rounded-lg border border-slate-200 px-3 text-sm" /><button type="button" onClick={verifyTwoFactor} disabled={code.length !== 6 || verifyingTwoFactor} className="rounded-lg bg-brand-primary px-3 text-xs font-semibold text-white disabled:opacity-50">{verifyingTwoFactor ? "Verifying..." : "Confirm"}</button></div><p className="mt-3 text-xs text-slate-500">Two-factor protection turns on only after this code is verified.</p></div> : null}{twoFactorEnabled ? <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-950">Authenticator is active</p><p className="mt-1 text-xs text-slate-500">{canDisableTwoFactor ? "This account now requires your authenticator code when you sign in." : "Complete a full two-factor sign-in before disabling this authenticator."}</p></div><button type="button" onClick={disableTwoFactor} disabled={!canDisableTwoFactor || disablingTwoFactor} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">{disablingTwoFactor ? "Disabling..." : "Disable"}</button></div></div> : null}</Card></div>; }

function CategoriesTab({ notify }: { notify: (message: string, error?: boolean) => void }) { const [settings, setSettings] = useState(() => readAppSettings()); const [kind, setKind] = useState<CategoryKind>("expense"); const [editing, setEditing] = useState<AppCategory | null>(null); const [form, setForm] = useState({ name: "", icon: "•", color: "#7db59c" }); const [dirty, setDirty] = useState(false); const categories = settings.categories.filter((category) => category.kind === kind).sort((a, b) => a.order - b.order); function openEdit(category?: AppCategory) { setEditing(category || null); setForm(category ? { name: category.name, icon: category.icon, color: category.color } : { name: "", icon: "•", color: "#7db59c" }); } function saveCategory(event: React.FormEvent) { event.preventDefault(); if (!form.name.trim()) return; const next = editing ? settings.categories.map((category) => category.id === editing.id ? { ...category, ...form, name: form.name.trim() } : category) : [...settings.categories, { id: createCategoryId(), kind, ...form, name: form.name.trim(), order: settings.categories.length }]; const nextSettings = { ...settings, categories: next }; setSettings(nextSettings); writeAppSettings(nextSettings); setDirty(false); setEditing(null); setForm({ name: "", icon: "•", color: "#7db59c" }); notify(editing ? "Category updated" : "Category added"); } function removeCategory(category: AppCategory) { if (!window.confirm(`Delete ${category.name}? Existing transactions keep their saved category.`)) return; const nextSettings = { ...settings, categories: settings.categories.filter((item) => item.id !== category.id) }; setSettings(nextSettings); writeAppSettings(nextSettings); notify("Category deleted"); } function move(category: AppCategory, direction: -1 | 1) { const list = [...categories]; const index = list.findIndex((item) => item.id === category.id); const other = list[index + direction]; if (!other) return; const next = settings.categories.map((item) => item.id === category.id ? { ...item, order: other.order } : item.id === other.id ? { ...item, order: category.order } : item); const nextSettings = { ...settings, categories: next }; setSettings(nextSettings); writeAppSettings(nextSettings); setDirty(false); } return <Card title="Categories" description="Manage the categories used by your bills, expenses, income, and budgets."><div className="mb-5 inline-flex rounded-xl border border-slate-200 p-1">{([["expense", "Expense categories"], ["income", "Income categories"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setKind(value)} className={`rounded-lg px-3 py-1.5 text-sm ${kind === value ? "bg-brand-muted font-semibold text-brand-primary" : "text-slate-500"}`}>{label}</button>)}</div><div className="space-y-2">{categories.map((category) => <div key={category.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><span className="grid h-9 w-9 place-items-center rounded-lg text-lg" style={{ backgroundColor: `${category.color}22` }}>{category.icon}</span><span className="flex-1 text-sm font-semibold text-slate-950">{category.name}</span><span className="h-4 w-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: category.color }} /><button type="button" onClick={() => move(category, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label={`Move ${category.name} up`}><ChevronUp className="h-4 w-4" /></button><button type="button" onClick={() => move(category, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label={`Move ${category.name} down`}><ChevronDown className="h-4 w-4" /></button><button type="button" onClick={() => openEdit(category)} className="text-xs font-semibold text-brand-primary">Edit</button><button type="button" onClick={() => removeCategory(category)} className="rounded p-1 text-red-500 hover:bg-red-50" aria-label={`Delete ${category.name}`}><Trash2 className="h-4 w-4" /></button></div>)}</div><form onSubmit={saveCategory} className="mt-5 border-t border-slate-200 pt-5"><div className="grid gap-3 md:grid-cols-[1fr_90px_120px_auto]"><input value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value }); setDirty(true); }} placeholder={`${kind === "expense" ? "Expense" : "Income"} category name`} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" /><input value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })} maxLength={2} aria-label="Category icon" className="h-10 rounded-xl border border-slate-200 px-3 text-center text-lg" /><input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} aria-label="Category color" className="h-10 w-full rounded-xl border border-slate-200 bg-white p-1" /><button type="submit" disabled={!dirty && !editing} className="inline-flex h-10 items-center justify-center gap-1 rounded-xl bg-brand-primary px-3 text-sm font-semibold text-white disabled:opacity-50">{editing ? "Update" : <><Plus className="h-4 w-4" />Add</>}</button></div></form></Card>; }

export function SettingsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) { const [activeTab, setActiveTab] = useState<SettingsTab>("Profile"); const [sidebarName, setSidebarName] = useState(getDisplayName(session)); const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null); function notify(message: string, error = false) { setToast({ message, error }); window.setTimeout(() => setToast(null), 3500); } return <DashboardShell activeLabel="Settings" title="Settings" name={sidebarName} onSignOut={onSignOut}><section className="grid gap-5 lg:grid-cols-[170px_1fr]"><nav aria-label="Settings sections" className="space-y-1">{settingsTabs.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`block h-9 w-full rounded-xl px-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-brand-primary ${activeTab === tab ? "bg-brand-muted font-semibold text-brand-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>{tab}</button>)}</nav><div>{activeTab === "Profile" ? <ProfileTab session={session} onSaved={setSidebarName} notify={notify} /> : null}{activeTab === "Preferences" ? <PreferencesTab notify={notify} /> : null}{activeTab === "Notifications" ? <NotificationsTab notify={notify} /> : null}{activeTab === "Security" ? <SecurityTab notify={notify} /> : null}{activeTab === "Categories" ? <CategoriesTab notify={notify} /> : null}</div></section>{toast ? <Toast message={toast.message} error={toast.error} onClose={() => setToast(null)} /> : null}</DashboardShell>; }
