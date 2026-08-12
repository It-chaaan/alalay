import { z } from "zod";

export const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(10_000),
  request_id: z.string().uuid().optional(),
  language: z.enum(["en", "fil"]).optional(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(10_000),
  }).strict()).max(20).optional(),
}).strict();
