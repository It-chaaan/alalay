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
const candidateApiBaseUrls = Array.from(
  new Set(
    [
      configuredApiUrl,
      "http://localhost:4000/api",
      "http://localhost:3000/api",
    ].filter((value): value is string => Boolean(value)),
  ),
);

export async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const supabase = getSupabaseClient();
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const token = session?.access_token;

  if (!token) {
    throw new Error("Please sign in again to load your data.");
  }

  let lastNetworkError: unknown = null;

  for (const baseUrl of candidateApiBaseUrls) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? "Request failed."
            : payload.error.details || payload.error.message,
        );
      }

      return payload.data;
    } catch (error: unknown) {
      if (error instanceof TypeError) {
        lastNetworkError = error;
        continue;
      }

      throw error;
    }
  }

  throw (
    lastNetworkError ??
    new Error(
      "Unable to reach the backend API. Check VITE_API_URL or start the backend server.",
    )
  );
}
