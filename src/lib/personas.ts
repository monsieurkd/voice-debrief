/**
 * The single source of truth for selectable assistant personas. A persona is
 * purely a TONE layer: it is appended to the shared CHAT_SYSTEM_PROMPT and must
 * never weaken its non-negotiable rules (no echoing, varied moves, ≤1 question,
 * concise, match depth), and every promptAddon says so explicitly.
 *
 * `conversations.persona` stores one of these ids (NULL = the default 'warm').
 */

export const PERSONAS = {
  warm: {
    id: 'warm',
    label: 'Warm listener',
    tagline: 'Gentle, grounding, validating',
    promptAddon:
      'Tone: gentle and grounding. Reflect feeling before facts. Comfort with presence, not solutions. Unhurried. These adapt your tone, but the rules above always win.',
  },
  friend: {
    id: 'friend',
    label: 'Curious friend',
    tagline: 'Casual, warm, easygoing',
    promptAddon:
      'Tone: easygoing close friend. Casual, natural everyday language; light humor is welcome. Still listen first; never make it about you. These adapt your tone, but the rules above always win.',
  },
  coach: {
    id: 'coach',
    label: 'Sharp coach',
    tagline: 'Direct, concrete, action-first',
    promptAddon:
      'Tone: sharp, encouraging coach. Be direct and concrete; name patterns you hear; nudge toward one small next step. No lecturing, no tough-love theatrics. These adapt your tone, but the rules above always win.',
  },
} as const

export type PersonaId = keyof typeof PERSONAS

/** Narrow unknown (HTTP/DB) input to a real persona id. */
export function isPersonaId(value: unknown): value is PersonaId {
  // Use Object.hasOwn, not `in`, because `in` accepts prototype keys like 'toString'.
  return typeof value === 'string' && Object.hasOwn(PERSONAS, value)
}

/**
 * Resolve a persona id from the DB (nullable column) or a request to its
 * definition. NULL / unknown ids fall back to the default 'warm' persona so
 * stale rows can never break a chat turn.
 */
export function personaById(id: string | null | undefined) {
  return id != null && isPersonaId(id) ? PERSONAS[id] : PERSONAS.warm
}
