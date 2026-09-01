import OpenAI from 'openai'
import { env } from './env'

// Any OpenAI-compatible provider works here (OpenRouter, Z.ai direct, OpenAI, …).
// Swap provider/model via LLM_BASE_URL / LLM_API_KEY / LLM_MODEL in .env.local.
// The HTTP-Referer / X-Title headers are OpenRouter attribution (harmless elsewhere).
export const llm = new OpenAI({
  apiKey: env.LLM_API_KEY || 'missing-key',
  baseURL: env.LLM_BASE_URL,
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Voice Debrief',
  },
})

/**
 * Failover client. Only present (non-null) when a fallback provider is
 * configured (LLM_FALLBACK_BASE_URL + LLM_FALLBACK_API_KEY). When both the
 * primary and a fallback are set, transient failures retried through the
 * `callWithFallback` helper transparently switch to this provider.
 */
export const llmFallback: OpenAI | null =
  env.LLM_FALLBACK_BASE_URL && env.LLM_FALLBACK_API_KEY
    ? new OpenAI({
        apiKey: env.LLM_FALLBACK_API_KEY,
        baseURL: env.LLM_FALLBACK_BASE_URL,
        defaultHeaders: {
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Voice Debrief',
        },
      })
    : null
