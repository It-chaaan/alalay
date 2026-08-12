import { z } from "zod";

export const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(10_000),
  request_id: z.string().uuid().optional(),
  pending_action: z.object({
    action: z.enum(["create_expense", "create_income", "create_transfer", "create_bill", "create_subscription"]),
    fields: z.record(z.string(), z.unknown()),
  }).nullable().optional(),
  language: z.enum(["en", "fil"]).optional(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(10_000),
  }).strict()).max(20).optional(),
}).strict();
