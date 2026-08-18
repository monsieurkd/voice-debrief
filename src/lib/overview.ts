import { llm } from './llm-client'
import { env } from './env'

/**
 * FAST model: the instant 2-liner overview (low-stakes → small model).
 * Never throws — returns null on any failure so runDebrief can fall back.
 */
export async function generateOverview(transcript: string): Promise<string | null> {
  if (!env.LLM_API_KEY) return null
  try {
    const res = await llm.chat.completions.create({
      model: env.LLM_SMALL_MODEL,
      temperature: 0.5,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content:
            "Summarize how this person's day went in 1–2 plain sentences (max 280 characters). Capture the emotional tone and the main thread. Output only the summary, no quotation marks.",
        },
        { role: 'user', content: transcript.slice(0, 8000) },
      ],
    })
    const text = (res.choices?.[0]?.message?.content ?? '').trim()
    return text ? text.slice(0, 280) : null
  } catch {
    return null
  }
}
