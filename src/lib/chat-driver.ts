import { completeWithFallback } from './llm-fallback'
import { env } from './env'
import { buildChatMessages } from './chat-prompt'
import type { PersonaId } from './personas'

/**
 * One assistant chat turn: history + the user's latest message → a reply.
 * Uses the FAST model (small) — the product is now chat-first and wants
 * responsive answers; the large thinking model has been removed.
 *
 * Plain text reply (no JSON), so no Zod round-trip — just a bounded, retried
 * chat call. Never throws raw provider errors to the client; the caller maps
 * via summarizeLlmError.
 */
export async function generateChatReply(
  history: { role: 'user' | 'assistant'; content: string }[],
  persona?: PersonaId,
): Promise<string> {
  const messages = buildChatMessages(history, persona)

  let res
  try {
    res = await completeWithFallback({
      messages,
      model: env.LLM_SMALL_MODEL,
      temperature: 0.9, // variety — the conversation should not feel repetitive
      maxTokens: 400,
    })
  } catch (e) {
    // Re-throw so the caller turns it into a friendly, safe message.
    throw new Error(e instanceof Error ? e.message : String(e))
  }

  const content = res.choices?.[0]?.message?.content?.trim() ?? ''
  if (!content) {
    throw new Error('The assistant returned an empty reply.')
  }
  return content
}
