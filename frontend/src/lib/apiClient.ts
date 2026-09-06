import { getSupabaseClient } from "./supabase";

type ApiSuccess<T> = { success: true; data: T; };
type ApiFailure = { success: false; error: { code: string; message: string; details?: string; correlationId?: string; }; };

export class ApiRequestError extends Error {
  readonly code: string;
  readonly correlationId?: string;
  readonly status?: number;
  constructor(message: string, code: string, correlationId?: string, status?: number) {
    super(message); this.name = "ApiRequestError"; this.code = code; this.correlationId = correlationId; this.status = status;
  }
}

const configuredApiUrl = import.meta.env.VITE_API_URL;
function normalizeApiBaseUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("VITE_API_URL must be an absolute http(s) backend URL, for example http://localhost:3000."); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("VITE_API_URL must use the http or https protocol.");
  if (import.meta.env.PROD && url.protocol !== "https:") throw new Error("VITE_API_URL must use https in production builds.");
  const baseUrl = url.toString().replace(/\/+$/, "");
  return baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
}
const apiBaseUrl = normalizeApiBaseUrl(configuredApiUrl ?? "http://localhost:3000/api");

function isJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("application/json") || contentType.includes("+json");
}
function responsePreview(body: string) {
  return body.replace(/<[^>]*>/g, " ").replace(/\b(bearer\s+)[^\s]+/gi, "$1[redacted]").replace(/\s+/g, " ").trim().slice(0, 160);
}
async function readApiPayload<T>(response: Response, path: string): Promise<ApiSuccess<T> | ApiFailure> {
  const contentType = response.headers.get("content-type");
  const body = await response.text();
  if (!isJsonResponse(response)) {
    if (import.meta.env.DEV) console.error("API returned a non-JSON response", { path, status: response.status, contentType: contentType ?? "missing", preview: responsePreview(body) });
    throw new ApiRequestError(`The API returned an unexpected response for ${path} (HTTP ${response.status}).`, "invalid_response", response.headers.get("x-correlation-id") ?? undefined, response.status);
  }
  try { return JSON.parse(body) as ApiSuccess<T> | ApiFailure; } catch {
    if (import.meta.env.DEV) console.error("API returned invalid JSON", { path, status: response.status, contentType, preview: responsePreview(body) });
    throw new ApiRequestError(`The API returned an invalid JSON response for ${path} (HTTP ${response.status}).`, "invalid_response", response.headers.get("x-correlation-id") ?? undefined, response.status);
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const { token } = await getAuthToken();
  try {
    let response = await fetch(`${apiBaseUrl}${path}`, { ...options, credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers } });
    if (response.status === 401) {
      const refreshed = await getAuthToken(true);
      response = await fetch(`${apiBaseUrl}${path}`, { ...options, credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${refreshed.token}`, ...options.headers } });
    }
    const payload = await readApiPayload<T>(response, path);
    if (!response.ok || !payload.success) {
      if (payload.success) throw new ApiRequestError("Request failed.", "request_failed", undefined, response.status);
      const requestError = new ApiRequestError(payload.error.message, payload.error.code, payload.error.correlationId, response.status);
      if (import.meta.env.DEV) console.error("API request failed", { path, status: response.status, code: requestError.code, correlationId: requestError.correlationId, details: payload.error.details });
      throw requestError;
    }
    return payload.data;
  } catch (error: unknown) {
    if (!(error instanceof TypeError)) throw error;
    throw new Error("Unable to reach the backend API. Check VITE_API_URL or start the backend server.");
  }
}

export async function apiStreamRequest(path: string, options: RequestInit, onEvent: (event: { event: string; data: unknown }) => void) {
  const { token } = await getAuthToken();
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, { ...options, credentials: "include", headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: `Bearer ${token}`, ...options.headers } });
    if (!response.ok) throw new Error("AI request failed. Please try again.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Unable to read the AI response stream.");
    const decoder = new TextDecoder(); let buffer = "";
    function handleEventBlock(eventBlock: string) {
      const eventName = eventBlock.match(/^event:\s*(.+)$/m)?.[1]?.trim() ?? "message";
      const data = eventBlock.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice("data:".length).trim()).join("\n");
      if (data) onEvent({ event: eventName, data: JSON.parse(data) });
    }
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true }); const events = buffer.split("\n\n"); buffer = events.pop() ?? "";
      for (const eventBlock of events) handleEventBlock(eventBlock);
    }
    if (buffer.trim()) handleEventBlock(buffer);
    return;
  } catch (error: unknown) {
    if (!(error instanceof TypeError)) throw error;
    throw new Error("Unable to reach the backend API. Check VITE_API_URL or start the backend server.");
  }
}

async function getAuthToken(forceRefresh = false) {
  const supabase = getSupabaseClient();
  let session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const expiresSoon = session?.expires_at !== undefined && session.expires_at <= Math.floor(Date.now() / 1000) + 60;
  if (supabase && (forceRefresh || expiresSoon)) { const refreshed = await supabase.auth.refreshSession(); session = refreshed.data.session ?? session; }
  const token = session?.access_token;
  if (!token) throw new Error("Please sign in again to load your data.");
  return { token };
}
