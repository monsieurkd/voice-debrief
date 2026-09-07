import type OpenAI from 'openai'
import { env } from './env'
import { llm, llmFallback } from './llm-client'

/**
 * Do an OpenAI-compatible chat completion; on a transient transport failure
 * (timeout / 429 / connection reset) retry through a configured fallback
 * provider instead of surfacing the error.
 *
 * Why this lives here: the "is this callable/retryable" classification and the
 * provider choice are shared between the plain-text chat path (chat-driver.ts)
 * and the JSON/legacy path (llm-call.ts), so there's exactly one failover
 * implementation.
 *
 * Controllable for tests:
 *  - `LLM_FALLBACK_BASE_URL` + `LLM_FALLBACK_API_KEY` must both be set, else
 *    this behaves exactly like a plain call (no fallback).
 *  - `LLM_FALLBACK_SMALL_MODEL` overrides the primary model for the fallback.
 *  - `opts.fallbackModelOverride` lets the JSON path hand in the appropriate
 *    strong model while the chat path uses LLM_SMALL_MODEL.
 */
export async function completeWithFallback(args: {
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
  model: string
  maxTokens?: number
  temperature?: number
  fallbackModelOverride?: string
  /**
   * Override the classifier+clients so tests need no network/env.
   * @internal test seam.
   */
  deps?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    primary?: { chat: { completions: { create: (body: any) => Promise<any> } } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fallback?: { chat: { completions: { create: (body: any) => Promise<any> } } } | null
    isTransient?: (e: unknown) => boolean
    /** Pin the fallback model (tests); default resolves from env/override. */
    fallbackModel?: string
  }
}): Promise<OpenAI.Chat.ChatCompletion> {
  const {
    messages,
    model,
    maxTokens = 400,
    temperature = 0.9,
    fallbackModelOverride,
    deps,
  } = args

  const primary = deps ? deps.primary ?? llm : llm
  // A deps-provided null fallback means "definitely no fallback" (tests);
  // only when deps is absent do we resolve the real configured fallback.
  const fallback = deps ? (deps.fallback !== undefined ? deps.fallback : llmFallback) : llmFallback
  const isTransient = deps?.isTransient ?? isTransientError

  const fallbackModel =
    deps?.fallbackModel ?? (env.LLM_FALLBACK_SMALL_MODEL || fallbackModelOverride || model)

  const body = (m: string) => ({
    model: m,
    messages,
    temperature,
    max_tokens: maxTokens,
  })

  try {
    return await primary.chat.completions.create(body(model))
  } catch (e) {
    // No fallback configured, or the error isn't the transient class (config,
    // auth, meaningful non-429 rejection, malformed request, etc.), then rethrow.
    if (!fallback || !isTransient(e)) throw e
    return await fallback.chat.completions.create(body(fallbackModel))
  }
}

/** Heuristic classifier for the transient class the failover is built for. */
export function isTransientError(e: unknown): boolean {
  if (e instanceof Error) {
    const msg = `${e.message} ${e.name}`.toLowerCase()
    if (
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('timedout') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('eai_again') ||
      msg.includes('fetch failed') ||
      msg.includes('socket hang up') ||
      msg.includes('und_err_connection')
    ) {
      return true
    }
  }
  // Anything that carries a 429 status is a rate-limit → transient.
  const status = (e as { status?: unknown })?.status
  if (status === 429) return true
  return false
}
