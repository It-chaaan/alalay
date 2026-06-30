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
  };
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const supabase = getSupabaseClient();
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const token = session?.access_token;

  if (!token) {
    throw new Error("Please sign in again to load your data.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;

  if (!response.ok || !payload.success) {
    throw new Error(payload.success ? "Request failed." : payload.error.message);
  }

  return payload.data;
}
