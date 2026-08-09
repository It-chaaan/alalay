import { client, requireUserId, throwIfError, asNumber } from "./db.js";
import { AppError } from "../utils/api.js";

export type WalletPayload = { name: string; institution_type: string; institution_key: string; color?: string; icon?: string | null };

async function ensureCash(userId: string) {
  const ownerId = requireUserId(userId);
  const existing = await client().from("wallets").select("*").eq("user_id", ownerId).eq("is_default_cash", true).maybeSingle();
  if (existing.data) return existing.data;
  const created = await client().from("wallets").insert({ user_id: ownerId, name: "Cash", institution_type: "cash", institution_key: "cash", color: "#0F8A6B", is_default_cash: true }).select("*").single();
  if (!created.error && created.data) return created.data;
  const retry = await client().from("wallets").select("*").eq("user_id", ownerId).eq("is_default_cash", true).single();
  throwIfError(retry.error);
  return retry.data;
}

function withBalance(row: Record<string, unknown>) {
  return { ...row, balance: asNumber(row.balance) };
}

export async function listWallets(userId: string) {
  await ensureCash(userId);
  const { data, error } = await client().from("wallets").select("*").eq("user_id", requireUserId(userId)).order("is_default_cash", { ascending: false }).order("created_at", { ascending: true });
  throwIfError(error);
  return (data ?? []).map(withBalance);
}

export async function getWallet(userId: string, id: string) {
  await ensureCash(userId);
  const ownerId = requireUserId(userId);
  const { data: wallet, error } = await client().from("wallets").select("*").eq("user_id", ownerId).eq("id", id).single();
  if (error || !wallet) throw new AppError(404, "not_found", "Wallet not found.");
  const [income, expenses, bills] = await Promise.all([
    client().from("income").select("id, source, amount, date, wallet_id").eq("user_id", ownerId).eq("wallet_id", id).is("deleted_at", null),
    client().from("expenses").select("id, merchant, category, amount, date, wallet_id").eq("user_id", ownerId).eq("wallet_id", id).is("deleted_at", null),
    client().from("bills").select("id, title, category, amount, due_date, paid_at, status, wallet_id").eq("user_id", ownerId).eq("wallet_id", id).eq("status", "paid").is("deleted_at", null),
  ]);
  throwIfError(income.error); throwIfError(expenses.error); throwIfError(bills.error);
  const transactions = [
    ...(income.data ?? []).map((row) => ({ ...row, kind: "income", label: row.source, date: row.date, amount: asNumber(row.amount) })),
    ...(expenses.data ?? []).map((row) => ({ ...row, kind: "expense", label: row.merchant, date: row.date, amount: -asNumber(row.amount) })),
    ...(bills.data ?? []).map((row) => ({ ...row, kind: "bill", label: row.title, date: row.paid_at ?? row.due_date, amount: -asNumber(row.amount) })),
  ].sort((left, right) => String(right.date).localeCompare(String(left.date)));
  return { wallet: withBalance(wallet), transactions };
}

export async function createWallet(userId: string, payload: WalletPayload) {
  const { data, error } = await client().from("wallets").insert({ ...payload, user_id: requireUserId(userId), color: payload.color ?? "#0F8A6B", is_default_cash: false }).select("*").single();
  throwIfError(error);
  return withBalance(data);
}

export async function updateWallet(userId: string, id: string, payload: Record<string, unknown>) {
  const { data, error } = await client().from("wallets").update(payload).eq("user_id", requireUserId(userId)).eq("id", id).eq("is_default_cash", false).select("*").single();
  if (error || !data) throw new AppError(404, "not_found", "Wallet not found or cannot be changed.");
  return withBalance(data);
}

export async function deleteWallet(userId: string, id: string) {
  const { data, error } = await client().from("wallets").delete().eq("user_id", requireUserId(userId)).eq("id", id).eq("is_default_cash", false).select("id").single();
  if (error || !data) throw new AppError(409, "wallet_in_use", "This wallet could not be removed. Unlink its transactions first.");
  return data;
}
