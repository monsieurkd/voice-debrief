import OpenAI from 'openai'
import { env } from './env'

/**
 * Provider-neutral batch speech-to-text, mirroring the `LLM_*` pattern for the
 * transcript pipeline so "voice debrief" works on EVERY browser (the recorder
 * path — the removed live-dictation mic was Chromium/Web-Speech-only).
 *
 * Routing: `LLM_ASR_*` env wins when set; otherwise transcription falls back to
 * the same base URL + key + headers as the main LLM provider — so OpenAI / Z.ai /
 * Gemini / OpenRouter works with ZERO extra configuration. The audio file never
 * leaves whatever endpoint this points at, which matters for the BYOK/privacy
 * wedge (the operator controls where ASR runs).
 *
 * Failure is surfaced as a typed error the action can map to a user-safe cause
 * (see summarizeAsrError) — never leaks provider internals to the client.
 */

/** Something went wrong talking to the transcription endpoint. */
export class AsrError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AsrError'
  }
}

/** The transcription endpoint isn't / can't be configured to run at all. */
export class AsrUnconfiguredError extends AsrError {
  constructor() {
    super("Speech-to-text isn't configured — add an LLM API key (or LLM_ASR_*) and try again.")
    this.name = 'AsrUnconfiguredError'
  }
}

/** Whether live transcription can work with the current env (used to hide the record button). */
export function asrConfigured(): boolean {
  return Boolean(asrBaseUrl() || asrApiKey())
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** A 429/5xx/transport failure from the ASR endpoint. */
export class AsrTransientError extends AsrError {
  constructor(message: string) {
    super(message)
    this.name = 'AsrTransientError'
  }
}

/** Whether a transcription error should be retried (transient rate/5xx/timeout),
 *  vs. treated as permanent (bad key, no endpoint, file too large). */
export function isRetryable(errAsText: string): boolean {
  const c = errAsText.toLowerCase()
  return (
    c.includes('429') || c.includes('rate limit') || c.includes('too many requests') ||
    c.includes('500') || c.includes('502') || c.includes('503') || c.includes('504') ||
    c.includes('timeout') || c.includes('etimedout') || c.includes('econnreset') || c.includes('socket hang up') ||
    c.includes('service unavailable') || c.includes('temporarily unavailable')
  )
}

/** The effective transcription base URL (LLM_ASR_BASE_URL → LLM_BASE_URL). */
export function asrBaseUrl(overrides: Pick<typeof env, 'LLM_ASR_BASE_URL' | 'LLM_BASE_URL'> = env): string {
  return (overrides.LLM_ASR_BASE_URL || '').trim() || overrides.LLM_BASE_URL
}

/** The effective ASR API key (LLM_ASR_API_KEY → LLM_API_KEY). Exported for tests. */
export function asrApiKey(overrides: Pick<typeof env, 'LLM_ASR_API_KEY' | 'LLM_API_KEY'> = env): string {
  // Any explicitly-set ASR key wins; otherwise reuse the main LLM key so one
  // API key powers both chat and transcription against the same provider.
  return (overrides.LLM_ASR_API_KEY || '').trim() || overrides.LLM_API_KEY
}

function asrClient(): OpenAI {
  return new OpenAI({
    apiKey: asrApiKey() || 'missing-key',
    baseURL: asrBaseUrl(),
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Voice Debrief',
    },
  })
}

/**
 * Transcribe a recorded audio blob → the spoken text. `audioBlob` is a Node
 * `Blob`/`File` carrying the mime type and a filename hint the API needs.
 */
export async function transcribeAudio(audioBlob: Blob, filename: string): Promise<string> {
  if (!asrConfigured()) throw new AsrUnconfiguredError()

  // Node 20+ exports `File` (a `Blob` subclass with a `name`) — the exact shape
  // the openai SDK's multipart upload accepts.
  const file =
    typeof File !== 'undefined' && audioBlob instanceof Blob && typeof File === 'function'
      ? new File([audioBlob], filename, { type: audioBlob.type || 'audio/webm' })
      : (Object.assign(audioBlob, { name: filename }) as unknown as File)

  // Groq free-tier is throttled hard; 429s are common. Retry transient failures
  // with exponential backoff so a busy moment doesn't silently kill a clip the
  // user went to the trouble of recording (bounded — we never loop forever).
  const TRANSPORT_ATTEMPTS = 3
  let transportTries = 0

  for (;;) {
    let text: string
    try {
      const res = await asrClient().audio.transcriptions.create({
        file,
        model: env.LLM_ASR_MODEL,
        response_format: 'text',
      })
      // The `text` response_format resolves to a plain string; `verbose_json` to
      // an object. Accept both defensively.
      text = typeof res === 'string' ? res : (res as { text?: string })?.text ?? ''
    } catch (e) {
      const cause = `${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`.toLowerCase()
      // Provider doesn't actually support /transcriptions (e.g. a chat-only
      // endpoint configured as the default). That's an env problem, not retryable.
      if (cause.includes('404') || cause.includes('not found') || cause.includes('path')) {
        throw new AsrError(
          'This provider does not expose a /transcriptions endpoint — set LLM_ASR_BASE_URL/LLM_ASR_API_KEY to a Whisper-capable ASR service.',
        )
      }
      // A 429/5xx/timeout/connection hiccup is transient on free tiers — wait
      // and retry a bounded number of times before surfacing a typed failure.
      if (isRetryable(cause)) {
        transportTries++
        if (transportTries < TRANSPORT_ATTEMPTS) {
          await delay(Math.min(600 * 2 ** (transportTries - 1), 5000))
          continue
        }
        const asr = new AsrTransientError('the speech-to-text service is busy, please retry in a moment')
        ;(asr as AsrTransientError & { causeText?: string }).causeText = cause
        throw asr
      }
      // Keep the failure typed so the action maps it with restore-friendly prose.
      const asr = new AsrError('the speech-to-text service failed to respond')
      ;(asr as AsrError & { causeText?: string }).causeText = cause
      throw asr
    }

    const clean = text.trim()
    if (!clean) throw new AsrError('Nothing could be heard in that recording — try again in a quiet spot.')
    return clean
  }
}

/** Map an ASR failure to a short, user-safe cause (never surfaces internals). */
export function summarizeAsrError(e: unknown): string {
  if (e instanceof AsrUnconfiguredError) return e.message
  if (e instanceof AsrError) {
    const raw = (e as AsrError & { causeText?: string }).causeText ?? e.message.toLowerCase()
    if (raw.includes('401') || raw.includes('api key') || raw.includes('unauthorized')) {
      return 'The speech-to-text key was rejected — check LLM_ASR_API_KEY.'
    }
    // A retried transient failure (still busy after backoffs): tell the user to
    // nudge it, with the one hint they have control over — wait and retry.
    if (e instanceof AsrTransientError) return e.message
    if (raw.includes('429') || raw.includes('rate limit')) {
      return 'The speech-to-text service is rate-limited right now — wait a minute and try again.'
    }
    if (raw.includes('timeout') || raw.includes('timed out')) return 'The transcription timed out — try again.'
    if (raw.includes('file too large')) return 'That recording is too long — keep it under a couple of minutes.'
    return e.message
  }
  return 'Could not transcribe the recording — try again.'
}
