import type OpenAI from 'openai'
import { env } from './env'
import { extractionPayload, type ExtractionPayload } from './extraction-schema'
import { SYSTEM_PROMPT } from './extract-prompt'
import { callJsonValidated, LlmCallError, type Complete } from './llm-call'

const MAX_ATTEMPTS = 3 // initial + 2 retries (spec §4: schema-validation retry)

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExtractionError'
  }
}

/**
 * transcript -> validated ExtractionPayload (strong model).
 * Delegates the call/parse/validate/retry loop to callJsonValidated.
 */
export async function extractDebrief(
  transcript: string,
  opts: { complete?: Complete } = {},
): Promise<ExtractionPayload> {
  if (!opts.complete && !env.LLM_API_KEY) {
    throw new ExtractionError('LLM_API_KEY is not set. Add it to .env.local.')
  }
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Transcript:\n"""\n${transcript}\n"""` },
  ]
  try {
    return await callJsonValidated({
      messages,
      schema: extractionPayload,
      model: env.LLM_MODEL,
      maxTokens: 8000, // Gemini 3.x thinking models need headroom for reasoning + output
      temperature: 0.2,
      attempts: MAX_ATTEMPTS,
      complete: opts.complete,
    })
  } catch (e) {
    if (e instanceof LlmCallError) throw new ExtractionError(e.message)
    throw e
  }
}
