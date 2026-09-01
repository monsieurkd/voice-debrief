import OpenAI from 'openai'
import { env } from './env'

/**
 * Provider-neutral text-to-speech for the assistant's voice output.
 *
 * Routes to an OpenAI-compatible `/audio/speech` endpoint. `LLM_TTS_*` wins
 * when set; otherwise it falls back to the same base URL + key as the chat
 * provider (so one provider can power text + voice with zero extra config).
 * If no TTS model is configured, the client hides the "hear it" affordance and
 * never calls this.
 */

export function ttsConfigured(): boolean {
  return Boolean(ttsModel())
}

export function ttsBaseUrl(): string {
  return (env.LLM_TTS_BASE_URL || '').trim() || env.LLM_BASE_URL
}
export function ttsApiKey(): string {
  return (env.LLM_TTS_API_KEY || '').trim() || env.LLM_API_KEY
}
export function ttsModel(): string {
  return (env.LLM_TTS_MODEL || '').trim() || ''
}

function ttsClient(): OpenAI {
  return new OpenAI({
    apiKey: ttsApiKey() || 'missing-key',
    baseURL: ttsBaseUrl(),
  })
}

/**
 * Synthesize assistant text → 16-bit PCM WAV bytes (base64). Returns null when
 * TTS isn't configured, so the caller can gracefully skip voice output.
 */
export async function synthesizeSpeech(text: string): Promise<string | null> {
  if (!ttsConfigured()) return null
  try {
    const res = await ttsClient().audio.speech.create({
      model: ttsModel(),
      voice: 'coral', // OpenAI-compatible voice id; providers that accept only a set will error loudly
      input: text.slice(0, 2000),
      response_format: 'wav',
    })
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.toString('base64')
  } catch {
    return null // voice is a nicety — never block the text reply over it
  }
}
