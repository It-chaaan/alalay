import { client, requireUserId } from "./db.js";
import { AppError } from "../utils/api.js";

type StoredAction = { status: "processing" | "succeeded"; action: string; result: Record<string, unknown> | null };

export async function runAiActionOnce(
  userId: string,
  requestId: string,
  action: string,
  operation: () => Promise<Record<string, unknown>>,
) {
  const ownerId = requireUserId(userId);
  const { error } = await client().from("ai_action_requests").insert({ user_id: ownerId, request_id: requestId, action, status: "processing" });
  if (error && error.code !== "23505") throw new AppError(503, "ai_action_unavailable", "Financial actions are temporarily unavailable.");

  if (error?.code === "23505") {
    const existing = await client().from("ai_action_requests").select("status, action, result").eq("user_id", ownerId).eq("request_id", requestId).maybeSingle();
    const row = existing.data as StoredAction | null;
    if (existing.error || !row) throw new AppError(503, "ai_action_unavailable", "Financial actions are temporarily unavailable.");
    if (row.action !== action) throw new AppError(409, "ai_action_conflict", "This request cannot be reused for a different financial action.");
    if (row.status === "processing") return { success: false, code: "action_in_progress", user_message: "That financial action is still being processed. Please wait a moment before trying again." };
    return row.result ?? { success: false, code: "action_failed", user_message: "That financial action did not complete." };
  }

  const result = await operation();
  await client().from("ai_action_requests").update({ status: "succeeded", result }).eq("user_id", ownerId).eq("request_id", requestId);
  return result;
}
