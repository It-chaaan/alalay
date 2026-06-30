import type { Session } from "@supabase/supabase-js";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useOcrScanner } from "../../hooks/useOcrScanner";

const ocrSteps = [
  { number: 1, label: "Upload", active: true },
  { number: 2, label: "Scan", active: false },
  { number: 3, label: "Review", active: false },
];

const ocrTips = [
  "Lay receipt flat on a dark surface",
  "Ensure all text is legible and in focus",
  "Include the full receipt from top to bottom",
  "Good lighting - avoid shadows on text",
];

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

export function OcrScannerPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = getDisplayName(session);
  const { data: capabilities, isLoading, error } = useOcrScanner();

  return (
    <DashboardShell activeLabel="OCR Scanner" title="OCR Scanner" subtitle="Scan a receipt to log expenses automatically" name={name} onSignOut={onSignOut}>
      <section className="flex flex-wrap items-center gap-4">
        {ocrSteps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-3">
            <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${step.active ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-500"}`}>{step.number}</span>
            <span className={`text-xs ${step.active ? "font-semibold text-slate-950" : "text-slate-500"}`}>{step.label}</span>
            {index < ocrSteps.length - 1 ? <span className="h-px w-12 bg-slate-200" /> : null}
          </div>
        ))}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="grid min-h-[280px] place-items-center rounded-[14px] border border-dashed border-slate-300 bg-white p-8 text-center">
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-muted text-brand-primary">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 4H4v3M20 7V4h-3M4 17v3h3M20 17v3h-3" /><path d="M9 12h6" /></svg>
              </span>
              <h2 className="mt-4 text-sm font-semibold text-slate-950">Drop your receipt here</h2>
              <p className="mt-1 text-xs text-slate-500">or click to browse - JPG, PNG, PDF supported</p>
              <label className="mt-4 inline-flex cursor-pointer rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark focus-within:ring-2 focus-within:ring-brand-primary focus-within:ring-offset-2">
                Choose file
                <input type="file" className="sr-only" accept="image/jpeg,image/png,application/pdf" />
              </label>
            </div>
          </div>
          <button type="button" className="mt-3 h-9 w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 shadow-sm transition hover:border-brand-primary hover:text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2">
            Try with sample receipt (demo)
          </button>
        </div>

        <aside className="space-y-3">
          <article className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Tips for best results</h2>
            <ul className="mt-4 space-y-3 text-xs text-slate-600">
              {ocrTips.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="text-brand-primary">✓</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-[14px] bg-brand-muted p-4 text-xs leading-5 text-brand-dark">
            <h2 className="font-semibold">What Alalay can read</h2>
            <p className="mt-2">
              {isLoading ? "Checking OCR capabilities..." : error ? error : capabilities?.message ?? "OCR capabilities are not available yet."}
            </p>
            {capabilities?.readable_fields?.length ? <p className="mt-2">Fields: {capabilities.readable_fields.join(", ")}</p> : null}
          </article>
        </aside>
      </section>
    </DashboardShell>
  );
}
