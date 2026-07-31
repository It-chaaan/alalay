import type { Session } from "@supabase/supabase-js";
import { Bot, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { type AiLanguage, useAiAssistant, useAiChat } from "../../hooks/useAiAssistant";

const aiPromptSuggestions = [
  "How much did I spend this month?",
  "Which bills are due this week?",
  "How can I save more money?",
  "Can I afford a PHP 1,500 purchase today?",
  "Compare this month vs last month.",
  "Tulungan mo akong mag-budget",
];

const languageOptions: Array<{ label: string; value: AiLanguage }> = [
  { label: "Auto", value: "auto" },
  { label: "EN", value: "en" },
  { label: "FIL", value: "fil" },
];

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

function AlalayMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-brand-primary text-white ${small ? "h-7 w-7" : "h-8 w-8"}`}>
      <Bot className={small ? "h-4 w-4" : "h-5 w-5"} aria-hidden="true" />
    </span>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="assistant-message break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export function AiAssistantPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = getDisplayName(session);
  const { data: status, isLoading: isStatusLoading, error: statusError } = useAiAssistant();
  const [language, setLanguage] = useState<AiLanguage>("auto");
  const [draft, setDraft] = useState("");
  const { messages, sendMessage, clearMessages, isStreaming, error } = useAiChat(session.user.id, language);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isConfigured = status?.status === "configured";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();

    if (!message) {
      return;
    }

    setDraft("");
    await sendMessage(message);
  }

  async function handleSuggestion(prompt: string) {
    setDraft("");
    await sendMessage(prompt);
  }

  return (
    <DashboardShell activeLabel="AI Assistant" title="AI Assistant" name={name} onSignOut={onSignOut} hideHeader contentMaxWidth="max-w-[980px]">
      <section className="flex min-h-[calc(100vh-64px)] flex-col">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <AlalayMark />
            <div>
              <h1 className="text-base font-semibold text-slate-950">Alalay AI</h1>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`h-1.5 w-1.5 rounded-full ${isConfigured ? "bg-[#3f7d16]" : "bg-amber-500"}`} />
                {isStatusLoading ? "Checking provider..." : isConfigured ? `${status.provider} - ${status.model}` : "AI backend not configured"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-xs">
              {languageOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLanguage(option.value)}
                  className={`rounded-lg px-3 py-1 font-semibold transition ${
                    language === option.value ? "bg-brand-primary text-white" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={clearMessages}
              className="inline-flex h-8 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Clear
            </button>
          </div>
        </header>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600 shadow-sm">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" aria-hidden="true" />
            <p>
              {statusError
                ? statusError
                : status?.message ?? "Ask about spending, bills, budget, subscriptions, savings goals, and financial health. I will use your latest Alalay data automatically."}
            </p>
          </div>
        </section>

        {messages.length === 0 ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {aiPromptSuggestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void handleSuggestion(prompt)}
                disabled={isStreaming}
                className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.length === 0 ? (
            <div className="flex items-start gap-3">
              <AlalayMark small />
              <div className="max-w-[560px] rounded-2xl border border-slate-200 border-l-4 border-l-brand-primary bg-white px-4 py-3 text-sm leading-6 text-slate-950 shadow-sm">
                Kumusta! Ask me about your bills, spending, budget, subscriptions, or savings. I will check your financial data before answering.
              </div>
            </div>
          ) : null}

          {messages.map((message) => {
            const isUser = message.role === "user";
            const isPendingAssistant = message.role === "assistant" && !message.content && isStreaming;

            return (
              <div key={message.id} className={`flex items-start gap-3 ${isUser ? "justify-end" : ""}`}>
                {!isUser ? <AlalayMark small /> : null}
                <div className={`max-w-[680px] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                  isUser
                    ? "bg-brand-primary text-white"
                    : "border border-slate-200 bg-white text-slate-950"
                }`}>
                  {isPendingAssistant ? (
                    <span className="inline-flex items-center gap-2 text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Thinking with your latest finance data...
                    </span>
                  ) : (
                    isUser ? <div className="whitespace-pre-wrap">{message.content}</div> : <AssistantMessage content={message.content} />
                  )}
                  <div className={`mt-2 text-[10px] ${isUser ? "text-white/70" : "text-slate-400"}`}>{formatTime(message.createdAt)}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {error ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div> : null}

        <form className="border-t border-slate-200 pt-4" onSubmit={handleSubmit}>
          <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/15">
            <label htmlFor="ai-message" className="sr-only">Ask Alalay AI</label>
            <input
              id="ai-message"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={isStreaming}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
              placeholder="Ask anything about your finances..."
            />
            <button
              type="submit"
              disabled={isStreaming || !draft.trim()}
              aria-label="Send message"
              className="grid h-9 w-9 place-items-center rounded-full bg-brand-primary text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </form>
      </section>
    </DashboardShell>
  );
}
