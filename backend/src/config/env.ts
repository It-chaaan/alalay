import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HTTPS_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  // Set true only when this process owns the TLS certificate (not on Render/Heroku/Railway/Vercel).
  HTTPS_TERMINATE_LOCALLY: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  HTTPS_CERT_PATH: z.string().optional(),
  HTTPS_KEY_PATH: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_THINKING_BUDGET: z.coerce.number().int().min(0).default(0),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Alalay <notifications@alalay.app>"),
  APP_URL: z.string().url().default("http://localhost:5173"),
  NOTIFICATION_SCHEDULER_ENABLED: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  BILLING_DEBUG: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
}).superRefine((value, ctx) => {
  const local = value.NODE_ENV !== "production";
  if (value.NODE_ENV === "production" && !value.HTTPS_ENABLED) {
    ctx.addIssue({ code: "custom", path: ["HTTPS_ENABLED"], message: "HTTPS_ENABLED=true is required in production." });
  }
  if (!local && !value.APP_URL.startsWith("https://")) {
    ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "APP_URL must use https outside local development." });
  }
  if (!local && !value.CORS_ORIGIN.split(",").every((origin) => origin.trim().startsWith("https://"))) {
    ctx.addIssue({ code: "custom", path: ["CORS_ORIGIN"], message: "CORS_ORIGIN must use https outside local development." });
  }
});

export const env = envSchema.parse(process.env);
