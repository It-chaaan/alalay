import { z } from "zod";
import { currencyAmount, safeDate } from "./common.schema.js";

export const walletInstitutionType = z.enum(["e_wallet", "digital_bank", "bank", "cash", "other"]);

export const createWalletSchema = z.object({
  name: z.string().trim().min(1).max(100),
  institution_type: walletInstitutionType,
  institution_key: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(40).nullable().optional(),
}).strict();

export const createWalletWithOpeningBalanceSchema = createWalletSchema.extend({
  opening_balance: currencyAmount,
}).strict();

export const updateWalletSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(40).nullable().optional(),
}).strict();

export const walletDepositSchema = z.object({
  amount: currencyAmount,
  date: safeDate,
  note: z.string().trim().max(500).nullable().optional(),
}).strict();
