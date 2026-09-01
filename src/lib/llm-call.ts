import type OpenAI from 'openai'
import type { ZodType } from 'zod'
import { llm } from './llm-client'
import { env } from './env'
import { safeJsonParse, summarizeZodIssues } from './json'

/**
 * Injectable completer — lets the retry loop be unit-tested without a key/network.
 * Receives the current token budget so truncation-escalation is observable.
 */
export type Complete = (
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  opts: { maxTokens: number },
) => Promise<string>

export class LlmCallError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmCallError'
  }
}

/** The HTTP call itself failed (timeout, 429, 401, connection reset) — the transient class. */
export class LlmTransportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmTransportError'
  }
}

/** The model hit max_tokens before finishing — retrying at the same budget cannot fix this. */
export class LlmTruncatedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmTruncatedError'
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Call an OpenAI-compatible chat model, parse JSON, and validate with a Zod schema.
 *
 * Three failure classes, three strategies:
 * - Transport errors (timeout / 429 / connection): retried with exponential backoff —
 *   they're the transient class.
 * - Truncated output (finish_reason === 'length', common with thinking models whose
 *   reasoning eats the budget): the token budget is doubled once; if it truncates
 *   again we fail loudly instead of looping.
 * - Parse/schema failures: the error is fed back to the model and the call retried
 *   (up to `attempts`), per the spec's bounded-retry design.
 *
 * The shared engine behind extraction (strong) and the fast overview (small).
 * Never mutates the caller's messages array.
 */
export async function callJsonValidated<T>(args: {
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
  schema: ZodType<T>
  model: string
  maxTokens: number
  temperature?: number
  attempts?: number
  transportAttempts?: number
  retryDelayMs?: number
  complete?: Complete
}): Promise<T> {
  const {
    messages,
    schema,
    model,
    maxTokens,
    temperature = 0.2,
    attempts = 3,
    transportAttempts = 3,
    retryDelayMs = 400,
    complete,
  } = args

  const doCall: Complete =
    complete ??
    (async (msgs, { maxTokens: budget }) => {
      if (!env.LLM_API_KEY) throw new LlmCallError('LLM_API_KEY is not set. Add it to .env.local.')
      let res: OpenAI.Chat.ChatCompletion
      try {
        res = await llm.chat.completions.create({
          model,
          messages: msgs,
          response_format: { type: 'json_object' },
          temperature,
          max_tokens: budget,
        })
      } catch (e) {
        throw new LlmTransportError(e instanceof Error ? e.message : String(e))
      }
      const choice = res.choices?.[0]
      if (choice?.finish_reason === 'length') {
        throw new LlmTruncatedError(`Output hit the ${budget}-token budget before finishing.`)
      }
      return choice?.message?.content ?? ''
    })

  const msgs = [...messages]
  let budget = maxTokens
  let budgetEscalated = false
  let transportTries = 0

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let raw: string

    // Get one response out of the model, absorbing transient failures.
    for (;;) {
      try {
        raw = await doCall(msgs, { maxTokens: budget })
        break
      } catch (e) {
        if (e instanceof LlmTruncatedError) {
          if (budgetEscalated) {
            throw new LlmCallError(
              `Model output was truncated even at ${budget} tokens — the input may be too large to extract in one call.`,
            )
          }
          budgetEscalated = true
          budget *= 2
          continue // same attempt, bigger budget — truncation is a budget problem
        }
        if (e instanceof LlmCallError) throw e // config errors are not retryable
        transportTries++
        if (transportTries >= transportAttempts) {
          throw new LlmCallError(
            `LLM request failed after ${transportAttempts} attempts: ${e instanceof Error ? e.message : String(e)}`,
          )
        }
        await delay(Math.min(retryDelayMs * 2 ** (transportTries - 1), 8000))
      }
    }

    let parsed: unknown
    try {
      parsed = safeJsonParse(raw)
    } catch {
      if (attempt < attempts) {
        msgs.push({ role: 'assistant', content: raw })
        msgs.push({ role: 'user', content: 'That was not valid JSON. Return ONLY the JSON object, no prose or fences.' })
        continue
      }
      throw new LlmCallError(`Could not parse JSON after ${attempts} attempts.`)
    }

    const result = schema.safeParse(parsed)
    if (result.success) return result.data

    if (attempt < attempts) {
      msgs.push({ role: 'assistant', content: raw })
      msgs.push({
        role: 'user',
        content: `Your JSON failed validation. Fix these and return ONLY corrected JSON:\n${summarizeZodIssues(result.error)}`,
      })
      continue
    }
    throw new LlmCallError(`Validation failed after ${attempts} attempts:\n${summarizeZodIssues(result.error)}`)
  }

  throw new LlmCallError('LLM call failed unexpectedly.')
}
