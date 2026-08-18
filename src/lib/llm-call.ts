import type OpenAI from 'openai'
import type { ZodType } from 'zod'
import { llm } from './llm-client'
import { env } from './env'
import { safeJsonParse, summarizeZodIssues } from './json'

/** Injectable completer — lets the retry loop be unit-tested without a key/network. */
export type Complete = (messages: OpenAI.Chat.ChatCompletionMessageParam[]) => Promise<string>

export class LlmCallError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmCallError'
  }
}

/**
 * Call an OpenAI-compatible chat model, parse JSON, and validate with a Zod schema.
 * On parse/validation failure, feed the error back and retry (up to `attempts`).
 * The shared engine behind extraction (strong) and the interview driver (small).
 */
export async function callJsonValidated<T>(args: {
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
  schema: ZodType<T>
  model: string
  maxTokens: number
  temperature?: number
  attempts?: number
  complete?: Complete
}): Promise<T> {
  const { messages, schema, model, maxTokens, temperature = 0.2, attempts = 3, complete } = args

  const doCall: Complete =
    complete ??
    (async (msgs) => {
      if (!env.LLM_API_KEY) throw new LlmCallError('LLM_API_KEY is not set. Add it to .env.local.')
      const res = await llm.chat.completions.create({
        model,
        messages: msgs,
        response_format: { type: 'json_object' },
        temperature,
        max_tokens: maxTokens,
      })
      return res.choices?.[0]?.message?.content ?? ''
    })

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let raw: string
    try {
      raw = await doCall(messages)
    } catch (e) {
      throw new LlmCallError(`LLM request failed: ${e instanceof Error ? e.message : String(e)}`)
    }

    let parsed: unknown
    try {
      parsed = safeJsonParse(raw)
    } catch {
      if (attempt < attempts) {
        messages.push({ role: 'assistant', content: raw })
        messages.push({ role: 'user', content: 'That was not valid JSON. Return ONLY the JSON object, no prose or fences.' })
        continue
      }
      throw new LlmCallError(`Could not parse JSON after ${attempts} attempts.`)
    }

    const result = schema.safeParse(parsed)
    if (result.success) return result.data

    if (attempt < attempts) {
      messages.push({ role: 'assistant', content: raw })
      messages.push({
        role: 'user',
        content: `Your JSON failed validation. Fix these and return ONLY corrected JSON:\n${summarizeZodIssues(result.error)}`,
      })
      continue
    }
    throw new LlmCallError(`Validation failed after ${attempts} attempts:\n${summarizeZodIssues(result.error)}`)
  }

  throw new LlmCallError('LLM call failed unexpectedly.')
}
