import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const nullableString = z.string().trim().min(1).nullable().optional();
