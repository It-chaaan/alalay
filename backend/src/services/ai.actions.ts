import { createBillSchema } from "../schemas/bill.schema.js";
import { createExpenseSchema } from "../schemas/expense.schema.js";
import { createIncomeSchema } from "../schemas/income.schema.js";
import { createSubscriptionSchema } from "../schemas/subscription.schema.js";
import { walletTransferSchema } from "../schemas/wallet.schema.js";
import { makeResourceService } from "./resource.service.js";
import { createBill } from "./bills.service.js";
import { createWalletTransfer, listWallets } from "./wallets.service.js";
import { todayIso } from "./db.js";
import { AppError } from "../utils/api.js";
import type { AiToolDefinition } from "./ai.providers.js";
import { runAiActionOnce } from "./ai.idempotency.service.js";

const amount = { type: "NUMBER", description: "Positive amount in the user's account currency." };
const date = { type: "STRING", description: "Calendar date in YYYY-MM-DD format. Resolve today/yesterday using Asia/Manila before calling." };
const walletName = { type: "STRING", description: "The user's wallet name, never an ID." };

export const aiToolDefinitions: AiToolDefinition[] = [
  { name: "create_expense", description: "Log a confirmed expense. Required: amount, category, merchant, date. Wallet is optional unless the user specifies one.", parameters: { type: "OBJECT", properties: { amount, category: { type: "STRING" }, merchant: { type: "STRING" }, date, wallet_name: walletName }, required: ["amount", "category", "merchant", "date"] } },
  { name: "create_income", description: "Log confirmed income. A destination wallet is required by the application.", parameters: { type: "OBJECT", properties: { amount, source: { type: "STRING" }, type: { type: "STRING" }, date, wallet_name: walletName }, required: ["amount", "source", "date", "wallet_name"] } },
  { name: "create_transfer", description: "Transfer funds atomically between two wallets owned by the user.", parameters: { type: "OBJECT", properties: { amount, from_wallet_name: walletName, to_wallet_name: walletName, date, note: { type: "STRING" } }, required: ["amount", "from_wallet_name", "to_wallet_name", "date"] } },
  { name: "create_bill", description: "Add a bill schedule. Required: title, amount, category, due date.", parameters: { type: "OBJECT", properties: { title: { type: "STRING" }, amount, category: { type: "STRING" }, due_date: date, recurring: { type: "BOOLEAN" }, frequency: { type: "STRING", enum: ["weekly", "monthly", "quarterly", "yearly"] }, notes: { type: "STRING" }, wallet_name: walletName }, required: ["title", "amount", "category", "due_date"] } },
  { name: "create_subscription", description: "Add a recurring subscription. A payment wallet is required by the application.", parameters: { type: "OBJECT", properties: { name: { type: "STRING" }, amount, category: { type: "STRING" }, renewal_date: date, billing_cycle: { type: "STRING", enum: ["weekly", "monthly", "quarterly", "yearly"] }, wallet_name: walletName }, required: ["name", "amount", "category", "renewal_date", "billing_cycle", "wallet_name"] } },
];

type ActionInput = { userId: string; requestId: string; name: string; args: Record<string, unknown> };

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

function resolveDate(value: unknown) {
  const raw = text(value).toLowerCase();
  if (raw === "today") return todayIso();
  if (raw === "yesterday" || raw === "tomorrow") {
    const current = todayIso().split("-").map(Number);
    const shifted = new Date(Date.UTC(current[0], current[1] - 1, current[2] + (raw === "yesterday" ? -1 : 1)));
    return shifted.toISOString().slice(0, 10);
  }
  const current = todayIso().split("-").map(Number);
  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const monthMatch = raw.match(new RegExp(`^(${monthNames.join("|")})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?$`));
  if (monthMatch) {
    const month = monthNames.indexOf(monthMatch[1]) + 1;
    const year = Number(monthMatch[3] ?? current[0]);
    const day = Number(monthMatch[2]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day) return candidate.toISOString().slice(0, 10);
  }
  const weekdayMatch = raw.match(/^(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (weekdayMatch) {
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const today = new Date(Date.UTC(current[0], current[1] - 1, current[2]));
    const target = weekdays.indexOf(weekdayMatch[2]);
    let days = (target - today.getUTCDay() + 7) % 7;
    if (weekdayMatch[1] || days === 0) days += 7;
    today.setUTCDate(today.getUTCDate() + days);
    return today.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  throw new AppError(400, "invalid_date", "Please provide the date as today, yesterday, or a calendar date.", undefined, true);
}

function normalize(value: string) { return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "").trim(); }

async function walletForName(userId: string, name: unknown) {
  const requested = text(name);
  if (!requested) throw new AppError(400, "wallet_required", "Which wallet should I use?", undefined, true);
  const wallets = await listWallets(userId) as unknown as Array<{ id: string; name: string }>;
  const key = normalize(requested);
  const matches = wallets.filter((wallet) => normalize(String(wallet.name)).includes(key) || key.includes(normalize(String(wallet.name))));
  if (!matches.length) throw new AppError(400, "wallet_not_found", `I couldn't find a wallet named ${requested}. Available wallets: ${wallets.map((wallet) => wallet.name).join(", ")}.`, undefined, true);
  if (matches.length > 1) throw new AppError(400, "wallet_ambiguous", `I found more than one matching wallet: ${matches.map((wallet) => wallet.name).join(", ")}. Which one did you mean?`, undefined, true);
  return matches[0];
}

function safeFailure(error: unknown) {
  if (error instanceof z.ZodError) return { success: false, code: "validation_error", user_message: `I need a little more valid information before I can save that: ${error.issues.map((issue) => issue.message).join(" ")}` };
  if (error instanceof AppError) {
    if (error.code === "transfer_invalid") {
      const detail = error.message.toLowerCase();
      if (detail.includes("enough available")) return { success: false, code: error.code, user_message: "I couldn't complete that transfer because the source wallet doesn't have enough available funds." };
      if (detail.includes("different destination")) return { success: false, code: error.code, user_message: "The source and destination wallets need to be different." };
      return { success: false, code: error.code, user_message: "I couldn't complete that transfer because it did not pass the wallet validation rules." };
    }
    if (error.status >= 500) return { success: false, code: error.code, user_message: "I couldn't complete that financial action right now. Nothing was added. Please try again." };
    return { success: false, code: error.code, user_message: error.message };
  }
  return { success: false, code: "action_failed", user_message: "I couldn't complete that financial action right now. Nothing was added. Please try again." };
}

async function performAiAction(input: ActionInput): Promise<Record<string, unknown>> {
  try {
    if (input.name === "create_expense") {
      const raw = input.args;
      const wallet = raw.wallet_name ? await walletForName(input.userId, raw.wallet_name) : null;
      const payload = createExpenseSchema.parse({ amount: raw.amount, category: text(raw.category), merchant: text(raw.merchant), date: resolveDate(raw.date), wallet_id: wallet?.id ?? null });
      const record = await makeResourceService("expenses").create(input.userId, payload);
      return { success: true, action: input.name, record_id: record.id, amount: record.amount, category: record.category, merchant: record.merchant, date: record.date, wallet: wallet?.name ?? null };
    }
    if (input.name === "create_income") {
      const wallet = await walletForName(input.userId, input.args.wallet_name);
      const payload = createIncomeSchema.parse({ amount: input.args.amount, source: text(input.args.source), type: text(input.args.type) || "Other", date: resolveDate(input.args.date), wallet_id: wallet.id });
      const record = await makeResourceService("income").create(input.userId, payload);
      return { success: true, action: input.name, record_id: record.id, amount: record.amount, source: record.source, date: record.date, wallet: wallet.name };
    }
    if (input.name === "create_transfer") {
      const from = await walletForName(input.userId, input.args.from_wallet_name);
      const to = await walletForName(input.userId, input.args.to_wallet_name);
      const payload = walletTransferSchema.parse({ from_wallet_id: from.id, to_wallet_id: to.id, amount: input.args.amount, date: resolveDate(input.args.date), note: text(input.args.note) || null, idempotency_key: input.requestId });
      const record = await createWalletTransfer(input.userId, payload);
      return { success: true, action: input.name, record_id: record?.id ?? null, amount: payload.amount, date: payload.date, from_wallet: from.name, to_wallet: to.name };
    }
    if (input.name === "create_bill") {
      const wallet = input.args.wallet_name ? await walletForName(input.userId, input.args.wallet_name) : null;
      const payload = createBillSchema.parse({ title: text(input.args.title), amount: input.args.amount, category: text(input.args.category), due_date: resolveDate(input.args.due_date), recurring: Boolean(input.args.recurring), frequency: input.args.frequency ?? null, notes: text(input.args.notes) || null, status: "unpaid", wallet_id: wallet?.id ?? null });
      const record = await createBill(input.userId, payload);
      return { success: true, action: input.name, record_id: record.id, amount: record.amount, title: record.title, due_date: record.due_date };
    }
    if (input.name === "create_subscription") {
      const wallet = await walletForName(input.userId, input.args.wallet_name);
      const payload = createSubscriptionSchema.parse({ name: text(input.args.name), amount: input.args.amount, category: text(input.args.category), renewal_date: resolveDate(input.args.renewal_date), billing_cycle: input.args.billing_cycle, wallet_id: wallet.id });
      const record = await makeResourceService("subscriptions").create(input.userId, payload);
      return { success: true, action: input.name, record_id: record.id, amount: record.amount, name: record.name, billing_cycle: record.billing_cycle, renewal_date: record.renewal_date, wallet: wallet.name };
    }
    return { success: false, code: "unsupported_action", user_message: "I can't perform that financial action." };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function executeAiAction(input: ActionInput): Promise<Record<string, unknown>> {
  return runAiActionOnce(input.userId, input.requestId, input.name, () => performAiAction(input));
}
import { z } from "zod";
