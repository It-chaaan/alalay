import { z } from "zod";
import { currencyAmount, safeDate } from "./common.schema.js";

const interest = z.discriminatedUnion("interest_type", [
  z.object({ interest_type: z.literal("none") }),
  z.object({ interest_type: z.literal("fixed"), fixed_interest_amount: currencyAmount.refine((value) => value > 0) }),
  z.object({ interest_type: z.literal("simple"), interest_rate: z.coerce.number().positive().max(1000) }),
]);

export const createLoanSchema = z.object({
  wallet_id: z.string().uuid(), direction: z.enum(["lent", "borrowed"]), counterparty: z.string().trim().min(1).max(120),
  principal: currencyAmount.refine((value) => value > 0), start_date: safeDate.optional(), due_date: safeDate.nullable().optional(), notes: z.string().trim().max(1000).nullable().optional(), idempotency_key: z.string().trim().min(16).max(100),
}).and(interest).superRefine((value, ctx) => { if (value.due_date && value.start_date && value.due_date < value.start_date) ctx.addIssue({ code: "custom", path: ["due_date"], message: "Due date cannot be before the start date." }); });

export const loanPaymentSchema = z.object({ wallet_id: z.string().uuid(), principal_amount: currencyAmount, interest_amount: currencyAmount, paid_on: safeDate.optional(), note: z.string().trim().max(1000).nullable().optional(), idempotency_key: z.string().trim().min(16).max(100) }).strict().refine((value) => value.principal_amount + value.interest_amount > 0, "Record a principal or interest amount.");
