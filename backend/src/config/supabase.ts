import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AsyncLocalStorage } from "node:async_hooks";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import ws from "ws";
import { env } from "./env.js";
import { AppError } from "../utils/api.js";

let supabaseClient: SupabaseClient | null = null;
const requestClient = new AsyncLocalStorage<SupabaseClient>();
const realtimeTransport = ws as unknown as WebSocketLikeConstructor;

export function getSupabase() {
  const scopedClient = requestClient.getStore();
  if (scopedClient) return scopedClient;

  return getServiceSupabase();
}

export function getServiceSupabase() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError(
      503,
      "supabase_not_configured",
      "Supabase backend is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.",
    );
  }

  supabaseClient ??= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: realtimeTransport,
    },
  });

  return supabaseClient;
}

export function runWithUserSupabase(token: string, callback: () => void) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new AppError(503, "supabase_not_configured", "Authentication service is not configured.");
  }

  const scopedClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: realtimeTransport },
  });
  requestClient.run(scopedClient, callback);
}
