import type { Session } from "@supabase/supabase-js";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useSettings } from "../../hooks/useSettings";

const settingsTabs = ["Profile", "Preferences", "Notifications", "Security", "Plan", "Categories"];

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

function Field({ label, value, type = "text" }: { label: string; value: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-950">{label}</span>
      <input type={type} defaultValue={value} className="mt-2 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20" />
    </label>
  );
}

export function SettingsPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = getDisplayName(session);
  const { data: profile, isLoading, error } = useSettings();
  const profileName = profile?.name || name;
  const profileEmail = profile?.email || session.user.email || "";
  const initials = profileName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "JD";

  return (
    <DashboardShell activeLabel="Settings" title="Settings" name={name} onSignOut={onSignOut}>
      <section className="grid gap-5 lg:grid-cols-[160px_1fr]">
        <nav aria-label="Settings sections" className="space-y-1">
          {settingsTabs.map((tab, index) => (
            <button key={tab} type="button" className={`block h-9 w-full rounded-xl px-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-brand-primary ${index === 0 ? "bg-brand-muted font-semibold text-brand-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
              {tab}
            </button>
          ))}
        </nav>

        <form className="rounded-[14px] border border-slate-200 bg-white p-6 shadow-sm">
          {isLoading ? <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Loading profile...</div> : null}
          {error ? <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          <div className="flex items-center gap-5">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-primary text-lg font-bold text-white">{initials}</span>
            <div>
              <h2 className="font-semibold text-slate-950">{profileName}</h2>
              <p className="text-sm text-slate-500">{profileEmail}</p>
              <button type="button" className="mt-1 text-xs font-semibold text-brand-primary hover:text-brand-dark">Change photo</button>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <Field label="Full name" value={profileName} />
            <Field label="Email address" value={profileEmail} type="email" />
            <Field label="Phone number" value="" type="tel" />
          </div>

          <fieldset className="mt-5">
            <legend className="text-xs font-semibold text-slate-950">Language</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-brand-primary bg-brand-muted px-3 text-sm font-medium text-brand-primary">
                <input type="radio" name="language" defaultChecked className="sr-only" />
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21M12 3c-2.5 2.7-3.8 5.7-3.8 9S9.5 18.3 12 21" /></svg>
                English
              </label>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600">
                <input type="radio" name="language" className="sr-only" />
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21M12 3c-2.5 2.7-3.8 5.7-3.8 9S9.5 18.3 12 21" /></svg>
                Filipino
              </label>
            </div>
          </fieldset>

          <button type="submit" className="mt-5 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2">
            Save changes
          </button>
        </form>
      </section>
    </DashboardShell>
  );
}
