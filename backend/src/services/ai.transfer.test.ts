import assert from "node:assert/strict";
import { matchWalletNames } from "./ai.actions.js";
import { transferDraftFor } from "./ai.service.js";

const wallets = [{ id: "cash-id", name: "Cash" }, { id: "gcash-id", name: "GCash" }];
assert.deepEqual(matchWalletNames(wallets, "cash").map((wallet) => wallet.name), ["Cash"]);
assert.deepEqual(matchWalletNames(wallets, "GCASH").map((wallet) => wallet.name), ["GCash"]);

const first = transferDraftFor({ userId: "user", message: "transfer ₱750 to gcash", pendingAction: null });
assert.deepEqual(first, { amount: 750, to_wallet_name: "gcash", date: "today" });

const completed = transferDraftFor({ userId: "user", message: "cash", pendingAction: { action: "create_transfer", fields: first } });
assert.deepEqual(completed, { amount: 750, to_wallet_name: "gcash", from_wallet_name: "cash", date: "today" });

const reversed = transferDraftFor({ userId: "user", message: "Transfer 750 from GCash to Cash today", pendingAction: null });
assert.deepEqual(reversed, { amount: 750, from_wallet_name: "GCash", to_wallet_name: "Cash", date: "today" });
