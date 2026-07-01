import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import ws from "ws";
import { env } from "./env.js";
import { AppError } from "../utils/api.js";

let supabaseClient: SupabaseClient | null = null;
const realtimeTransport = ws as unknown as WebSocketLikeConstructor;

export function getSupabase() {
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
