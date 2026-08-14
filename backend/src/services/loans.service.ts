import { asNumber, client, monthRange, requireUserId, throwIfError } from "./db.js";
import { AppError } from "../utils/api.js";

type LoanPayload = { wallet_id: string; direction: "lent" | "borrowed"; counterparty: string; principal: number; interest_type: "none" | "fixed" | "simple"; interest_rate?: number; fixed_interest_amount?: number; start_date?: string; due_date?: string | null; notes?: string | null; idempotency_key: string };
type PaymentPayload = { wallet_id: string; principal_amount: number; interest_amount: number; paid_on?: string; note?: string | null; idempotency_key: string };
type LoanRow = Record<string, unknown> & { direction: "lent" | "borrowed"; status: "active" | "paid" | "written_off"; outstanding_principal: number };
const numeric = (row: Record<string, unknown>): LoanRow => ({ ...row, direction: row.direction as LoanRow["direction"], status: row.status as LoanRow["status"], original_principal: asNumber(row.original_principal), outstanding_principal: asNumber(row.outstanding_principal), interest_rate: row.interest_rate == null ? null : asNumber(row.interest_rate), fixed_interest_amount: row.fixed_interest_amount == null ? null : asNumber(row.fixed_interest_amount) });

export async function listLoans(userId: string) {
  const ownerId = requireUserId(userId);
  const { data, error } = await client().from("loans").select("*, wallets(name), loan_payments(id, principal_amount, interest_amount, paid_on, note, wallets(name))").eq("user_id", ownerId).order("status").order("due_date", { ascending: true, nullsFirst: false });
  throwIfError(error);
  const rows = (data ?? []).map((row) => numeric(row as Record<string, unknown>));
  const owed_to_me = rows.filter((row) => row.direction === "lent" && row.status === "active").reduce((sum, row) => sum + row.outstanding_principal, 0);
  const i_owe = rows.filter((row) => row.direction === "borrowed" && row.status === "active").reduce((sum, row) => sum + row.outstanding_principal, 0);
  const { start, end } = monthRange();
  const payments: Array<Record<string, unknown> & { direction: "lent" | "borrowed" }> = rows.flatMap((row) => Array.isArray(row.loan_payments) ? (row.loan_payments as Array<Record<string, unknown>>).map((payment) => ({ ...payment, direction: row.direction })) : []);
  const currentMonth = payments.filter((payment) => String(payment.paid_on).slice(0, 10) >= start && String(payment.paid_on).slice(0, 10) <= end);
  const interest_earned_this_month = currentMonth.reduce((sum, payment) => sum + (payment.direction === "lent" ? asNumber(payment.interest_amount) : 0), 0);
  const interest_paid_this_month = currentMonth.reduce((sum, payment) => sum + (payment.direction === "borrowed" ? asNumber(payment.interest_amount) : 0), 0);
  return { loans: rows, summary: { owed_to_me, i_owe, net_position: owed_to_me - i_owe, interest_earned_this_month, interest_paid_this_month } };
}

export async function createLoan(userId: string, payload: LoanPayload) {
  requireUserId(userId);
  const { data, error } = await client().rpc("create_loan", { wallet_id_value: payload.wallet_id, loan_direction: payload.direction, counterparty_value: payload.counterparty, principal_value: payload.principal, interest_type_value: payload.interest_type, interest_rate_value: payload.interest_rate ?? null, fixed_interest_value: payload.fixed_interest_amount ?? null, start_date_value: payload.start_date ?? null, due_date_value: payload.due_date ?? null, notes_value: payload.notes ?? null, request_key: payload.idempotency_key });
  if (error) return loanError(error.message); return numeric(data as Record<string, unknown>);
}
export async function recordLoanPayment(userId: string, loanId: string, payload: PaymentPayload) {
  requireUserId(userId);
  const { data, error } = await client().rpc("record_loan_payment", { loan_id_value: loanId, wallet_id_value: payload.wallet_id, principal_value: payload.principal_amount, interest_value: payload.interest_amount, paid_on_value: payload.paid_on ?? null, note_value: payload.note ?? null, request_key: payload.idempotency_key });
  if (error) return loanError(error.message); return data;
}
export async function writeOffLoan(userId: string, loanId: string) { requireUserId(userId); const { data, error } = await client().rpc("write_off_loan", { loan_id_value: loanId }); if (error) return loanError(error.message); return numeric(data as Record<string, unknown>); }
function loanError(message: string): never { const lower = message.toLowerCase(); if (lower.includes("no longer") || lower.includes("not active")) throw new AppError(409, "loan_not_active", message, undefined, true); if (lower.includes("enough") || lower.includes("exceeds") || lower.includes("invalid") || lower.includes("greater than")) throw new AppError(422, "loan_invalid", message, undefined, true); throwIfError({ message }); throw new Error("Unreachable"); }
