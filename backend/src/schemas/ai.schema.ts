import { z } from "zod";

export const aiChatSchema = z.object({
  message: z.string().min(1),
  language: z.enum(["en", "fil"]).optional(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1),
  })).max(20).optional(),
});
