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
    // Calm persona identity (Digital Sanctuary). `aura` is the listener orb /
    // avatar gradient for "this voice"; kept desaturated and aligned to the
    // curated lavender/emerald/sage families — never a third loud accent on the
    // page (see docs/ui-rubric.md). `chip` tints the composer voice selector so
    // the active voice is legible at a glance. Warm (default) = lavender.
    aura: 'radial-gradient(circle_at_32%_28%, #dcc9f6 0%, #ad8fef 45%, #7557cf 100%)',
    chip: 'border-primary-ring/30 bg-[#e9e2fb] text-[#4a3f76]',
    promptAddon:
      'Tone: gentle and grounding. Reflect feeling before facts. Comfort with presence, not solutions. Unhurried. These adapt your tone, but the rules above always win.',
  },
  friend: {
    id: 'friend',
    label: 'Curious friend',
    tagline: 'Casual, warm, easygoing',
    aura: 'radial-gradient(circle_at_32%_28%, #cdeeda 0%, #83d5a7 46%, #3aa879 100%)',
    chip: 'border-emerald-100 bg-[#e7f2ea] text-[#2f6b4f]',
    promptAddon:
      'Tone: easygoing close friend. Casual, natural everyday language; light humor is welcome. Still listen first; never make it about you. These adapt your tone, but the rules above always win.',
  },
  coach: {
    id: 'coach',
    label: 'Sharp coach',
    tagline: 'Direct, concrete, action-first',
    aura: 'radial-gradient(circle_at_32%_28%, #c4d8ed 0%, #8dabdc 46%, #5174bd 100%)',
    chip: 'border-primary-ring/25 bg-secondary-container text-[#3b5a80]',
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
