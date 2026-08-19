import dotenv from 'dotenv'
// Next.js loads .env.local automatically for app code; this makes the same file
// available to scripts (tsx) and drizzle-kit that import this module. dotenv does
// NOT override vars already in process.env, so it's harmless inside Next.
dotenv.config({ path: '.env.local' })

import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  // Signs session cookies (see lib/session-token.ts). Optional here so DB-only
  // scripts/tests can boot without it — using auth without it fails loudly.
  AUTH_SECRET: z.string().default(''),
  LLM_API_KEY: z.string().default(''),
  LLM_BASE_URL: z.string().default('https://api.z.ai/api/coding/paas/v4'),
  // strong model for the precision extraction task
  LLM_MODEL: z.string().default('glm-4.6'),
  // fast model for the low-stakes overview + interview driver
  LLM_SMALL_MODEL: z.string().default('glm-4.5-air'),
})

export const env = envSchema.parse(process.env)
