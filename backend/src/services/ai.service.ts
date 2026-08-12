import { env } from "../config/env.js";
import { buildFinancialContext } from "./ai.context.service.js";
import { type AiMessage, getAiProvider } from "./ai.providers.js";
import { executeAiAction, aiToolDefinitions } from "./ai.actions.js";
import { randomUUID } from "node:crypto";

export type AiChatRequest = {
  userId: string;
  message: string;
  requestId?: string;
  pendingAction?: { action: "create_expense" | "create_income" | "create_transfer" | "create_bill" | "create_subscription"; fields: Record<string, unknown> } | null;
  language?: "en" | "fil";
  history?: AiMessage[];
};

type TransferDraft = { amount?: number; from_wallet_name?: string; to_wallet_name?: string; date?: string };

function isCancellation(message: string) {
  return /^(?:never\s+mind|cancel|cancel\s+that|stop|no,?\s+thanks)\s*[.!]?$/i.test(message.trim());
}

function isTransferContinuation(message: string) {
  return /\b(?:from|to|transfer|move|send|wallet|account|cash|gcash|maya|today|yesterday|tomorrow|amount|peso|php)\b/i.test(message)
    || /^\s*(?:₱|php)?\s*\d[\d,]*(?:\.\d{1,2})?\s*$/i.test(message);
}

function transferMutationMessage(message: string, pendingAction: AiChatRequest["pendingAction"]) {
  if (pendingAction?.action === "create_transfer") return isTransferContinuation(message);
  return /\b(transfer|move|send)\b/i.test(message) && !/\b(what if|can i|should i|would it)\b/i.test(message);
}

function cleanWalletPhrase(value: string) {
  return value
    .replace(/[,.!?]+$/g, "")
    .replace(/\s+(?:and\s+)?(?:date|on)\s+(?:today|yesterday|tomorrow|\w+\s+\d{1,2})\b.*$/i, "")
    .replace(/\b(?:my|the)\b/gi, " ")
    .replace(/\b(?:e[-\s]?wallet|wallet|account)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function transferDraftFor(request: AiChatRequest): TransferDraft {
  const draft: TransferDraft = request.pendingAction?.action === "create_transfer" ? { ...(request.pendingAction.fields as TransferDraft) } : {};
  const message = request.message.trim();
  const amountMatch = message.match(/(?:₱|php\s*)?([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  if (amountMatch) draft.amount = Number(amountMatch[1].replace(/,/g, ""));

  const fromTo = message.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s+(?:and\s+)?(?:date|on)\b|\s+(?:today|yesterday|tomorrow)\b|$)/i);
  const toFrom = message.match(/\bto\s+(.+?)\s+from\s+(.+?)(?:\s+(?:and\s+)?(?:date|on)\b|\s+(?:today|yesterday|tomorrow)\b|$)/i);
  const sourceFirst = message.match(/\b(?:transfer|move|send)\b[^\n]*?\b(?:₱|php\s*)?[0-9][0-9,]*(?:\.\d{1,2})?\s+(.+?)\s+to\s+(.+?)(?:\s+(?:today|yesterday|tomorrow)\b|$)/i);
  if (fromTo) {
    draft.from_wallet_name = cleanWalletPhrase(fromTo[1]);
    draft.to_wallet_name = cleanWalletPhrase(fromTo[2]);
  } else if (toFrom) {
    draft.to_wallet_name = cleanWalletPhrase(toFrom[1]);
    draft.from_wallet_name = cleanWalletPhrase(toFrom[2]);
  } else if (sourceFirst) {
    draft.from_wallet_name = cleanWalletPhrase(sourceFirst[1]);
    draft.to_wallet_name = cleanWalletPhrase(sourceFirst[2]);
  } else {
    const sourceOnly = message.match(/\bfrom\s+([^\n]+?)(?:\s+(?:today|yesterday|tomorrow)\b|$)/i);
    if (sourceOnly) draft.from_wallet_name = cleanWalletPhrase(sourceOnly[1]);
    const destination = message.match(/\bto\s+([^\n]+?)(?:\s+(?:today|yesterday|tomorrow)\b|$)/i);
    if (destination) draft.to_wallet_name = cleanWalletPhrase(destination[1]);
    const singleWallet = message.match(/^(?:from\s+)?([a-z][a-z\s-]+)$/i);
    if (singleWallet && request.pendingAction?.action === "create_transfer") {
      const wallet = cleanWalletPhrase(singleWallet[1]);
      if (request.pendingAction.fields.missing_role === "source") draft.from_wallet_name = wallet;
      else if (request.pendingAction.fields.missing_role === "destination") draft.to_wallet_name = wallet;
      else if (!draft.from_wallet_name) draft.from_wallet_name = wallet;
      else if (!draft.to_wallet_name) draft.to_wallet_name = wallet;
    }
  }
  if (/\btoday\b/i.test(message)) draft.date = "today";
  else if (/\byesterday\b/i.test(message)) draft.date = "yesterday";
  else if (/\btomorrow\b/i.test(message)) draft.date = "tomorrow";
  draft.date ??= "today";
  return draft;
}

function transferReply(result: Record<string, unknown>, draft: TransferDraft) {
  if (result.success === true) return `Done — I transferred ₱${Number(result.amount ?? draft.amount).toLocaleString("en-PH")} from ${result.from_wallet} to ${result.to_wallet}.`;
  return String(result.user_message ?? "I couldn't complete that transfer. Please check the wallet details and try again.");
}

function detectLanguage(message: string, requested?: "en" | "fil") {
  if (requested) {
    return requested;
  }

  return /\b(ako|ang|ng|mga|ba|bakit|paano|magkano|bayarin|gastos|ipon|kaya)\b/i.test(message) ? "fil" : "en";
}

export async function aiStatus() {
  const provider = getAiProvider();
  const configured = provider.isConfigured();

  return {
    status: configured ? "configured" : "not_configured",
    provider: configured ? provider.name : null,
    model: configured ? env.GEMINI_MODEL : null,
    message: configured
      ? `AI Assistant is configured with ${provider.name}.`
      : "AI Assistant backend is not configured yet. Add an AI provider API key before enabling chat.",
  };
}

export async function chat(request: AiChatRequest) {
  const provider = getAiProvider();
  const language = detectLanguage(request.message, request.language);
  if (request.pendingAction?.action === "create_transfer" && isCancellation(request.message)) {
    return { status: "ok", provider: provider.name, model: env.GEMINI_MODEL, language, financialMutation: false, pendingAction: null, message: "No problem — I cancelled that transfer." };
  }
  const pendingTransferContinues = request.pendingAction?.action === "create_transfer" && transferMutationMessage(request.message, request.pendingAction);
  if (transferMutationMessage(request.message, request.pendingAction)) {
    const draft = transferDraftFor(request);
    const pendingBase = { action: "create_transfer" as const, fields: draft as Record<string, unknown> };
    if (!draft.amount) return { status: "ok", provider: provider.name, model: env.GEMINI_MODEL, language, financialMutation: false, pendingAction: pendingBase, message: "How much would you like me to transfer?" };
    if (!draft.from_wallet_name) return { status: "ok", provider: provider.name, model: env.GEMINI_MODEL, language, financialMutation: false, pendingAction: { ...pendingBase, fields: { ...draft, missing_role: "source" } }, message: `Which wallet would you like me to transfer the ₱${draft.amount.toLocaleString("en-PH")} from?` };
    if (!draft.to_wallet_name) return { status: "ok", provider: provider.name, model: env.GEMINI_MODEL, language, financialMutation: false, pendingAction: { ...pendingBase, fields: { ...draft, missing_role: "destination" } }, message: "Which wallet should receive the transfer?" };
    const result = await executeAiAction({ userId: request.userId, requestId: request.requestId ?? randomUUID(), name: "create_transfer", args: draft });
    const failedWalletRole = result.success === false && (result.code === "wallet_not_found" || result.code === "wallet_ambiguous")
      ? (String(result.user_message).toLowerCase().includes(String(draft.from_wallet_name).toLowerCase()) ? "source" : "destination")
      : undefined;
    return { status: "ok", provider: provider.name, model: env.GEMINI_MODEL, language, financialMutation: result.success === true, pendingAction: result.success === true ? null : { ...pendingBase, fields: { ...draft, ...(failedWalletRole ? { missing_role: failedWalletRole } : {}) } }, message: transferReply(result, draft) };
  }
  const financialContext = await buildFinancialContext(request.userId, request.message);
  let financialMutation = false;
  let pendingAction: AiChatRequest["pendingAction"] = null;
  const reply = await provider.generate({
    message: request.message,
    language,
    history: request.history ?? [],
    financialContext,
    pendingAction: pendingTransferContinues ? request.pendingAction : null,
  }, { tools: aiToolDefinitions, executeTool: async (name, args) => {
    const result = await executeAiAction({ userId: request.userId, requestId: request.requestId ?? randomUUID(), name, args });
    financialMutation = financialMutation || result.success === true;
    if (result.pendingAction && typeof result.pendingAction === "object") pendingAction = result.pendingAction as AiChatRequest["pendingAction"];
    return result;
  } });

  return {
    status: "ok",
    provider: provider.name,
    model: env.GEMINI_MODEL,
    language,
    financialMutation,
    pendingAction,
    message: reply,
  };
}

export async function streamChat(request: AiChatRequest, onToken: (token: string) => void | Promise<void>) {
  const provider = getAiProvider();
  const language = detectLanguage(request.message, request.language);
  const financialContext = await buildFinancialContext(request.userId, request.message);
  const reply = await provider.stream(
    {
      message: request.message,
      language,
      history: request.history ?? [],
      financialContext,
    },
    onToken,
  );

  return {
    provider: provider.name,
    model: env.GEMINI_MODEL,
    language,
    message: reply,
  };
}
