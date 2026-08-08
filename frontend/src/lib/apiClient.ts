import { getSupabaseClient } from "./supabase";

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
};

const configuredApiUrl = import.meta.env.VITE_API_URL;

if (import.meta.env.PROD && configuredApiUrl && !configuredApiUrl.startsWith("https://")) {
  throw new Error("VITE_API_URL must use https in production builds.");
}

function normalizeApiBaseUrl(value: string) {
  const baseUrl = value.replace(/\/+$/, "");
  return baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
}

const apiBaseUrl = normalizeApiBaseUrl(
  configuredApiUrl ?? "http://localhost:3000/api",
);

export async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const { token } = await getAuthToken();

  try {
      let response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      // A tab can remain open past the access-token lifetime even when the
      // Supabase UI session still exists. Refresh once and replay only 401s;
      // never weaken backend verification or retry arbitrary failures.
      if (response.status === 401) {
        const refreshed = await getAuthToken(true);
        response = await fetch(`${apiBaseUrl}${path}`, {
          ...options,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshed.token}`,
            ...options.headers,
          },
        });
      }

      const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? "Request failed."
            : payload.error.message,
        );
      }

      return payload.data;
  } catch (error: unknown) {
    if (!(error instanceof TypeError)) {
      throw error;
    }

    throw new Error(
      "Unable to reach the backend API. Check VITE_API_URL or start the backend server.",
    );
  }
}

export async function apiStreamRequest(
  path: string,
  options: RequestInit,
  onEvent: (event: { event: string; data: unknown }) => void,
) {
  const { token } = await getAuthToken();
  try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error("AI request failed. Please try again.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Unable to read the AI response stream.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      function handleEventBlock(eventBlock: string) {
        const eventName = eventBlock.match(/^event:\s*(.+)$/m)?.[1]?.trim() ?? "message";
        const data = eventBlock
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice("data:".length).trim())
          .join("\n");

        if (data) {
          onEvent({ event: eventName, data: JSON.parse(data) });
        }
      }

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const eventBlock of events) {
          handleEventBlock(eventBlock);
        }
      }

      if (buffer.trim()) {
        handleEventBlock(buffer);
      }

      return;
  } catch (error: unknown) {
    if (!(error instanceof TypeError)) {
      throw error;
    }

    throw new Error(
      "Unable to reach the backend API. Check VITE_API_URL or start the backend server.",
    );
  }
}

async function getAuthToken(forceRefresh = false) {
  const supabase = getSupabaseClient();
  let session = supabase ? (await supabase.auth.getSession()).data.session : null;

  const expiresSoon = session?.expires_at !== undefined && session.expires_at <= Math.floor(Date.now() / 1000) + 60;
  if (supabase && (forceRefresh || expiresSoon)) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session ?? session;
  }

  const token = session?.access_token;

  if (!token) {
    throw new Error("Please sign in again to load your data.");
  }

  return { token };
}
