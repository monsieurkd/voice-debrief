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
