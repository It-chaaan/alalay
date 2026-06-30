import type { Session } from "@supabase/supabase-js";
import { DashboardShell } from "../../components/layout/DashboardShell";

export function AppPlaceholderPage({
  session,
  onSignOut,
  label,
}: {
  session: Session;
  onSignOut: () => void;
  label: string;
}) {
  const name = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Juan";

  return (
    <DashboardShell activeLabel={label} title={label} name={name} onSignOut={onSignOut}>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
        This section is ready for its dedicated interface.
      </div>
    </DashboardShell>
  );
}
