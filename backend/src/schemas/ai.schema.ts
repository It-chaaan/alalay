import { z } from "zod";

export const aiChatSchema = z.object({
  message: z.string().min(1),
  language: z.enum(["en", "fil"]).optional(),
});
