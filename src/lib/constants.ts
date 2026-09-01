// Spend guardrails (fixed windows, DB-backed so serverless instances share
// them). Authenticated actions key by user id; the auth pages key by IP.
export const DEMO_LIMITS = {
  // Chat turns per user per window — each one is a billed LLM round-trip.
  chatTurnsPerHour: 60,
  // Batch STT clips per user per window — each one is a billed ASR round-trip.
  transcriptionsPerHour: 20,
} as const
export const RATE_WINDOW_MS = 60 * 60 * 1000
