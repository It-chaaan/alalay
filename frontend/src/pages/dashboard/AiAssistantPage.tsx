import type { Session } from "@supabase/supabase-js";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { useAiAssistant } from "../../hooks/useAiAssistant";

const aiPromptSuggestions = [
  "How much did I spend this month?",
  "Which bills are due this week?",
  "How's my Laptop Fund going?",
  "Any subscriptions should I cancel?",
  "What's my financial health score?",
  "Tulungan mo akong mag-budget",
];

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

function AlalayMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-brand-primary text-white ${small ? "h-7 w-7" : "h-8 w-8"}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className={small ? "h-4 w-4" : "h-5 w-5"} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6.2 13.8c4.6.2 8-2 10.2-6.6" />
        <path d="M5 18.5c7.8.4 13.5-5.2 13.9-13.1-7.9.4-13.5 6.1-13.9 13.1Z" />
      </svg>
    </span>
  );
}

export function AiAssistantPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = getDisplayName(session);
  const { data: status, isLoading, error } = useAiAssistant();

  return (
    <DashboardShell activeLabel="AI Assistant" title="AI Assistant" name={name} onSignOut={onSignOut} hideHeader>
      <section className="flex min-h-[calc(100vh-64px)] flex-col">
        <header className="flex items-start justify-between border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <AlalayMark />
            <div>
              <h1 className="text-base font-semibold text-slate-950">Alalay AI</h1>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3f7d16]" />
                Active · Bilingual
              </p>
            </div>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-xs">
            <button type="button" className="rounded-lg bg-brand-primary px-3 py-1 font-semibold text-white">EN</button>
            <button type="button" className="rounded-lg px-3 py-1 text-slate-500">FIL</button>
          </div>
        </header>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {aiPromptSuggestions.map((prompt) => (
            <button key={prompt} type="button" className="h-9 rounded-2xl border border-slate-200 bg-white px-3 text-left text-xs text-slate-700 shadow-sm transition hover:border-brand-primary hover:text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2">
              {prompt}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-3">
          <AlalayMark small />
          <div className="max-w-[450px] rounded-2xl border border-slate-200 border-l-4 border-l-brand-primary bg-white px-4 py-3 text-sm leading-6 text-slate-950 shadow-sm">
            {isLoading ? "Checking AI Assistant status..." : error ? error : status?.message ?? "Kumusta! Ask me about your bills, spending, and savings."}
          </div>
        </div>

        <div className="mt-auto border-t border-slate-200 pt-4">
          <div className="flex h-12 items-center rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
            <label htmlFor="ai-message" className="sr-only">Ask Alalay AI</label>
            <input id="ai-message" type="text" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Ask anything about your finances..." />
            <button type="button" aria-label="Record voice message" className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" /></svg>
            </button>
            <button type="button" aria-label="Send message" className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-brand-primary hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></svg>
            </button>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
