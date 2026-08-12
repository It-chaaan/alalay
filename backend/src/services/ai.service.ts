import { env } from "../config/env.js";
import { buildFinancialContext } from "./ai.context.service.js";
import { type AiMessage, getAiProvider } from "./ai.providers.js";
import { executeAiAction, aiToolDefinitions } from "./ai.actions.js";
import { randomUUID } from "node:crypto";

export type AiChatRequest = {
  userId: string;
  message: string;
  requestId?: string;
  language?: "en" | "fil";
  history?: AiMessage[];
};

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
  const financialContext = await buildFinancialContext(request.userId, request.message);
  let financialMutation = false;
  const reply = await provider.generate({
    message: request.message,
    language,
    history: request.history ?? [],
    financialContext,
  }, { tools: aiToolDefinitions, executeTool: async (name, args) => {
    const result = await executeAiAction({ userId: request.userId, requestId: request.requestId ?? randomUUID(), name, args });
    financialMutation = financialMutation || result.success === true;
    return result;
  } });

  return {
    status: "ok",
    provider: provider.name,
    model: env.GEMINI_MODEL,
    language,
    financialMutation,
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
