import assert from "node:assert/strict";
import { aiChatSchema } from "./ai.schema.js";

const valid = aiChatSchema.safeParse({
  message: "Cash",
  pendingAction: { action: "create_transfer", fields: { amount: 750, to_wallet_name: "GCash", missing_role: "source" } },
});
assert.equal(valid.success, true);

const legacy = aiChatSchema.safeParse({ message: "Cash", pending_action: null });
assert.equal(legacy.success, false);

console.log("AI chat contract tests passed");
