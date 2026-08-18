/**
 * Map an LLM failure to a short, user-safe cause. Raw provider errors can
 * embed base URLs, request shapes, and internal details — never surface them
 * to the client; log the full error server-side and show one of these.
 */
export function summarizeLlmError(e: unknown): string {
  const msg = `${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`.toLowerCase()
  if (msg.includes('llm_api_key is not set')) return 'no API key is configured'
  if (msg.includes('api key') || /\b401\b/.test(msg) || msg.includes('unauthorized')) {
    return 'the API key was rejected'
  }
  if (msg.includes('429') || msg.includes('rate limit')) return 'the model is rate-limited right now'
  if (msg.includes('timeout') || msg.includes('timed out')) return 'the model timed out'
  if (msg.includes('truncated') || msg.includes('token budget')) return 'the model ran out of output budget'
  return 'the model failed to respond'
}
