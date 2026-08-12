import { getSupabaseClient } from './supabase';
import { getTrustedDeviceToken } from './trusted-device';

type ApiEnvelope<T> = {
  data?: T;
  error?: { code?: string; message?: string; correlationId?: string };
};

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string, public readonly correlationId?: string) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function messageForResponse(status: number, serverMessage?: string) {
  if (status === 401) return 'Your session expired. Please sign in again.';
  if (status === 403) return "You don't have permission to perform this action.";
  if (status === 400 || status === 422) return serverMessage ?? 'Check the information and try again.';
  if (status === 409) return serverMessage ?? 'This change conflicts with existing data.';
  if (status >= 500) return 'The service is temporarily unavailable. Please try again.';
  return serverMessage ?? 'Something went wrong while saving. Please try again.';
}

export function chatErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === 'network_error' || error.code === 'network_error_after_refresh') return "I couldn't reach Alalay right now. Check your connection and try again.";
    if (error.status === 401 || error.code === 'unauthorized' || error.code === 'auth_required') return 'Your session has expired. Please sign in again.';
    if (error.code === 'validation_error' || error.code === 'invalid_json') return "I couldn't process that request right now. Please try again.";
    if (error.code === 'ai_provider_error' || error.code === 'ai_empty_response' || error.code === 'ai_action_loop' || error.code === 'ai_not_configured') return "I couldn't process that message right now. Please try again.";
    if (error.status >= 500) return "I couldn't complete that right now. Please try again.";
    return "I couldn't complete that request. Please check the details and try again.";
  }
  return "I couldn't complete that right now. Please try again.";
}

function requestPath(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function normalizeApiBaseUrl(value: string) {
  const base = value.replace(/\/+$/, '');
  return base.endsWith('/api') ? base.slice(0, -4) : base;
}

function logApi(message: string, details?: Record<string, unknown>) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.info(`[API] ${message}`, details ?? '');
}

export async function authenticatedApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const supabase = getSupabaseClient();
  let { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  // Auth state can be restored a moment after the dashboard mounts. Refresh once
  // before reporting a misleading "sign in again" error.
  if (!data.session && supabase) {
    const refreshed = await supabase.auth.refreshSession();
    data = refreshed.data;
  }
  const accessToken = data.session?.access_token;
  const trustedDeviceToken = await getTrustedDeviceToken();

  if (!apiUrl || !accessToken) {
    throw new ApiRequestError('Sign in again before using this feature.', 401, 'auth_required');
  }

  const url = `${normalizeApiBaseUrl(apiUrl)}${path}`;
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    ...(trustedDeviceToken ? { 'X-Trusted-Device': trustedDeviceToken } : {}),
    ...init.headers,
  };
  const send = () => fetch(url, { ...init, headers });
  let response: Response;
  try {
    logApi(`${init.method ?? 'GET'} ${requestPath(url)} -> request`);
    response = await send();
  } catch {
    logApi(`${init.method ?? 'GET'} ${requestPath(url)} -> network_error`);
    throw new ApiRequestError('The service is temporarily unavailable. Please try again.', 0, 'network_error');
  }

  // A persisted mobile session can outlive its access token. Refresh once,
  // then replay only 401 responses; never retry a financial write otherwise.
  if (response.status === 401 && supabase) {
    const refreshed = await supabase.auth.refreshSession();
    const refreshedToken = refreshed.data.session?.access_token;
    if (refreshedToken) {
      try {
        response = await fetch(url, { ...init, headers: { ...headers, Authorization: `Bearer ${refreshedToken}` } });
      } catch {
        logApi(`${init.method ?? 'GET'} ${requestPath(url)} -> network_error_after_refresh`);
        throw new ApiRequestError('The service is temporarily unavailable. Please try again.', 0, 'network_error_after_refresh');
      }
    }
  }

  let payload: ApiEnvelope<T> = {};
  try {
    payload = await response.json() as ApiEnvelope<T>;
  } catch {
    logApi(`${init.method ?? 'GET'} ${requestPath(url)} -> ${response.status}`, { code: 'invalid_response' });
    throw new ApiRequestError(messageForResponse(response.status), response.status, 'invalid_response');
  }

  logApi(`${init.method ?? 'GET'} ${requestPath(url)} -> ${response.status}`, { code: payload.error?.code, message: payload.error?.message });
  if (!response.ok || payload.data === undefined) {
    throw new ApiRequestError(messageForResponse(response.status, payload.error?.message), response.status, payload.error?.code ?? 'api_error', payload.error?.correlationId);
  }

  return payload.data;
}
