import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  ELEVENLABS_API_KEY: z.string().min(20),
  ELEVENLABS_AGENT_ID: z.string().min(3).optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(20),
  RESEND_API_KEY: z.string().min(10),
  RESEND_FROM_EMAIL: z.string().min(3),
  APP_URL: z.string().url().default("http://localhost:5173"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_SECRET: z.string().min(8).default("local-dev-bootstrap-secret"),
  NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),
  DEV_BYPASS_EMAIL_GATE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(parsed.error.flatten());
  throw new Error("Invalid environment variables.");
}

export const env = parsed.data;
