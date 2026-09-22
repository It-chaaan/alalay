import { getSupabaseClient } from './supabase';
import { getTrustedDeviceToken } from './trusted-device';

type ApiEnvelope<T> = {
  data?: T;
  error?: { code?: string; message?: string; correlationId?: string };
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function messageForResponse(status: number, serverMessage?: string, code?: string) {
  if (status === 401) return 'Your session expired. Please sign in again.';
  if (status === 403) return "You don't have permission to perform this action.";
  if (status === 404) return 'This record no longer exists.';
  if ((status === 400 || status === 422) && code === 'validation_error')
    return 'Check the information and try again.';
  if (status === 400 || status === 422)
    return serverMessage ?? 'Check the information and try again.';
  if (status === 409) return serverMessage ?? 'This change conflicts with existing data.';
  if (status >= 500) return 'The service is temporarily unavailable. Please try again.';
  return serverMessage ?? 'Something went wrong while saving. Please try again.';
}

export function chatErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === 'network_error' || error.code === 'network_error_after_refresh')
      return 'Alalay can’t connect right now. Check your connection and try again.';
    if (error.status === 401 || error.code === 'unauthorized' || error.code === 'auth_required')
      return 'Your session has expired. Please sign in again.';
    if (error.code === 'rate_limited' || error.status === 429)
      return 'You’ve sent several requests quickly. Please wait a moment and try again.';
    if (error.code === 'database_error' || error.code === 'financial_data_error')
      return 'Alalay couldn’t load your financial information. Please try again.';
    if (
      error.code === 'ai_not_configured' ||
      error.code === 'ai_provider_error' ||
      error.code === 'ai_empty_response' ||
      error.code === 'ai_action_loop'
    )
      return 'Alalay’s AI service is temporarily unavailable. Your financial records are safe.';
    if (error.code === 'validation_error' || error.code === 'invalid_json')
      return "I couldn't process that request right now. Please try again.";
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

export function createRequestId() {
  return `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function requestFailure(error: unknown, timedOut: boolean, externallyAborted: boolean) {
  if (timedOut) return { code: 'timeout_error', message: 'The request timed out.' } as const;
  if (externallyAborted)
    return { code: 'request_aborted', message: 'The request was cancelled.' } as const;
  if (error instanceof TypeError) return { code: 'network_error', message: error.message } as const;
  return {
    code: 'request_error',
    message: error instanceof Error ? error.message : String(error),
  } as const;
}

type TransportFailure = Error & { apiFailureCode?: string };

function timedSignal(signal: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  let externallyAborted = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abort = () => {
    externallyAborted = true;
    controller.abort();
  };
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    },
    wasTimedOut: () => timedOut,
    wasExternallyAborted: () => externallyAborted,
  };
}

export async function authenticatedApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const supabase = getSupabaseClient();
  let { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
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
  const clientRequestId = createRequestId();
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'X-Request-Id': clientRequestId,
    ...(trustedDeviceToken ? { 'X-Trusted-Device': trustedDeviceToken } : {}),
    ...init.headers,
  };
  const send = (requestHeaders: typeof headers) => {
    const request = timedSignal(init.signal, 30_000);
    return fetch(url, { ...init, headers: requestHeaders, signal: request.signal })
      .catch((error: unknown) => {
        const failure = requestFailure(
          error,
          request.wasTimedOut(),
          request.wasExternallyAborted(),
        );
        const transportError = new Error(failure.message) as TransportFailure;
        transportError.apiFailureCode = failure.code;
        throw transportError;
      })
      .finally(request.cleanup);
  };
  let response: Response;
  try {
    logApi(`${init.method ?? 'GET'} ${requestPath(url)} -> request`, {
      requestId: clientRequestId,
    });
    response = await send(headers);
  } catch (error) {
    const failureCode = (error as TransportFailure).apiFailureCode ?? 'request_error';
    logApi(`${init.method ?? 'GET'} ${requestPath(url)} -> ${failureCode}`, {
      requestId: clientRequestId,
      detail: error instanceof Error ? error.message : String(error),
    });
    throw new ApiRequestError(
      failureCode === 'request_aborted'
        ? 'The request was cancelled.'
        : failureCode === 'timeout_error'
          ? 'The request timed out. Please try again.'
          : 'The service is temporarily unavailable. Please try again.',
      0,
      failureCode,
    );
  }

  // A persisted mobile session can outlive its access token. Refresh once,
  // then replay only 401 responses; never retry a financial write otherwise.
  if (response.status === 401 && supabase) {
    const refreshed = await supabase.auth.refreshSession();
    const refreshedToken = refreshed.data.session?.access_token;
    if (refreshedToken) {
      try {
        response = await send({ ...headers, Authorization: `Bearer ${refreshedToken}` });
      } catch (error) {
        logApi(`${init.method ?? 'GET'} ${requestPath(url)} -> network_error_after_refresh`, {
          requestId: clientRequestId,
          detail: error instanceof Error ? error.message : String(error),
        });
        throw new ApiRequestError(
          'The service is temporarily unavailable. Please try again.',
          0,
          'network_error_after_refresh',
        );
      }
    }
  }

  let payload: ApiEnvelope<T> = {};
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    logApi(`${init.method ?? 'GET'} ${requestPath(url)} -> ${response.status}`, {
      code: 'invalid_response',
    });
    throw new ApiRequestError(
      messageForResponse(response.status),
      response.status,
      'invalid_response',
    );
  }

  logApi(`${init.method ?? 'GET'} ${requestPath(url)} -> ${response.status}`, {
    requestId: clientRequestId,
    ...(payload.error?.code ? { code: payload.error.code } : {}),
    ...(payload.error?.message ? { message: payload.error.message } : {}),
    ...(payload.error?.correlationId ? { correlationId: payload.error.correlationId } : {}),
  });
  if (!response.ok || payload.data === undefined) {
    throw new ApiRequestError(
      messageForResponse(response.status, payload.error?.message, payload.error?.code),
      response.status,
      payload.error?.code ?? 'api_error',
      payload.error?.correlationId ?? response.headers.get('X-Correlation-Id') ?? undefined,
    );
  }

  return payload.data;
}
