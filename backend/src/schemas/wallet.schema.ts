import { z } from "zod";

export const walletInstitutionType = z.enum(["e_wallet", "digital_bank", "bank", "cash", "other"]);

export const createWalletSchema = z.object({
  name: z.string().trim().min(1).max(100),
  institution_type: walletInstitutionType,
  institution_key: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(40).nullable().optional(),
}).strict();

export const updateWalletSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(40).nullable().optional(),
}).strict();
