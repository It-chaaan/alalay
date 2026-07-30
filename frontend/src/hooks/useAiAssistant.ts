import { useCallback, useEffect, useMemo, useState } from "react";
import { apiStreamRequest } from "../lib/apiClient";
import { useApiQuery } from "./useApiQuery";

export type AiLanguage = "en" | "fil";

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type AiStatus = {
  status: string;
  provider: string | null;
  model: string | null;
  message: string;
};

function createMessage(role: AiChatMessage["role"], content: string): AiChatMessage {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function storageKey(userId: string) {
  return `alalay-ai-chat:${userId}`;
}

function loadMessages(userId: string) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];

    const parsed = JSON.parse(raw) as AiChatMessage[];
    return Array.isArray(parsed) ? parsed.filter((message) => message.role === "user" || message.role === "assistant") : [];
  } catch {
    return [];
  }
}

export function useAiAssistant() {
  return useApiQuery<AiStatus>("/ai/status");
}

export function useAiChat(userId: string, language: AiLanguage) {
  const [messages, setMessages] = useState<AiChatMessage[]>(() => loadMessages(userId));
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages(loadMessages(userId));
  }, [userId]);

  useEffect(() => {
    localStorage.setItem(storageKey(userId), JSON.stringify(messages.slice(-40)));
  }, [messages, userId]);

  const history = useMemo(
    () => messages.slice(-12).map((message) => ({ role: message.role, content: message.content })),
    [messages],
  );

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();

    if (!trimmed || isStreaming) {
      return;
    }

    const userMessage = createMessage("user", trimmed);
    const assistantMessage = createMessage("assistant", "");

    setError(null);
    setIsStreaming(true);
    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      await apiStreamRequest(
        "/ai/chat/stream",
        {
          method: "POST",
          body: JSON.stringify({
            message: trimmed,
            language,
            history,
          }),
        },
        ({ event, data }) => {
          if (event === "token") {
            const token = typeof data === "object" && data && "token" in data ? String((data as { token: unknown }).token) : "";

            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, content: `${message.content}${token}` }
                  : message,
              ),
            );
          }

          if (event === "done") {
            const finalMessage = typeof data === "object" && data && "message" in data ? String((data as { message: unknown }).message) : "";

            if (finalMessage) {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessage.id
                    ? { ...message, content: message.content || finalMessage }
                    : message,
                ),
              );
            }
          }

          if (event === "error") {
            const message = typeof data === "object" && data && "message" in data ? String((data as { message: unknown }).message) : "AI request failed.";
            throw new Error(message);
          }
        },
      );
    } catch (streamError: unknown) {
      const message = streamError instanceof Error ? streamError.message : "AI request failed.";
      setError(message);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: message }
            : item,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }, [history, isStreaming, language]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    localStorage.removeItem(storageKey(userId));
  }, [userId]);

  return {
    messages,
    sendMessage,
    clearMessages,
    isStreaming,
    error,
  };
}
