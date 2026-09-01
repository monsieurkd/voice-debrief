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
  // fast model for the low-stakes overview
  LLM_SMALL_MODEL: z.string().default('glm-4.5-air'),

  // ── Speech-to-text (ASR), provider-neutral ─────────────────────────────
  // Defaults to whatever LLM provider is configured (same base URL + key), so
  // OpenAI / Z.ai / Gemini / OpenRouter works with ZERO extra env. Override
  // LLM_ASR_* to point transcription at a different ASR endpoint/model
  // (e.g. a dedicated Whisper deployment). Omitting all of these = live STT
  // uses the main LLM provider.
  LLM_ASR_BASE_URL: z.string().default(''),
  LLM_ASR_API_KEY: z.string().default(''),
  // Whisper-family model names persist the input language, so no `language`
  // field is hardcoded — the transcriptions api returns its own detected lang.
  LLM_ASR_MODEL: z.string().default('whisper-1'),

  // ── Speech-to-text output (TTS), provider-neutral ────────────────────────
  // Optional. When set, the assistant replies are spoken aloud (AI voice out).
  // Reuses the chat provider (LLM_BASE_URL/key) unless LLM_TTS_* overrides.
  LLM_TTS_BASE_URL: z.string().default(''),
  LLM_TTS_API_KEY: z.string().default(''),
  LLM_TTS_MODEL: z.string().default(''),
})

export const env = envSchema.parse(process.env)
