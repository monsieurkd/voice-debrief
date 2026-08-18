import type OpenAI from 'openai'
import { z } from 'zod'
import { env } from './env'
import { callJsonValidated } from './llm-call'

export type Checklist = { events: boolean; decisions: boolean; next_steps: boolean }
export interface InterviewHints {
  mood?: string | null
  engagement?: number | null
  pace?: string | null
}

const interviewTurnSchema = z.object({
  reply: z.string().min(1).max(600),
  covered: z.object({
    events: z.boolean().default(false),
    decisions: z.boolean().default(false),
    next_steps: z.boolean().default(false),
  }),
})
export type InterviewTurn = z.infer<typeof interviewTurnSchema>

function missingFields(c: Checklist): string {
  const m: string[] = []
  if (!c.events) m.push('events — what actually happened today')
  if (!c.decisions) m.push('decisions — what got decided (settled OR still hanging; both count)')
  if (!c.next_steps) m.push('next_steps — the concrete next move')
  if (!m.length) {
    return 'All three are already covered — do NOT probe further. Just reflect warmly and let them wrap up.'
  }
  return `Not yet covered (you may gently probe ONE of these, only if there is a natural opening): ${m.join('; ')}.`
}

function hintsBlock(h: InterviewHints): string {
  const bits: string[] = []
  if (h.mood) bits.push(`recent mood ${h.mood}`)
  if (h.engagement != null) bits.push(`recent engagement ${h.engagement}/5`)
  if (h.pace) bits.push(`preferred pace ${h.pace}`)
  if (!bits.length) return ''
  return `\nAdaptation (from prior sessions — ${bits.join(', ')}): if low/tired/terse, be briefer and gentler, with fewer probes.`
}

export function buildInterviewSystemPrompt(checklist: Checklist, hints: InterviewHints): string {
  return `You are a warm, non-judgmental interviewer debriefing someone about their day. Help them get it all out, and quietly make sure three things surface — what happened, what they decided, and their next move. You are NOT a coach: ZERO advice, ZERO "you should", ZERO problem-solving. You only listen, reflect, and occasionally ask one gentle question.

RULES:
- REFLECT before you steer. Every reply starts by acknowledging what they just said (e.g. "that sounds like it weighed on you") BEFORE any question.
- At most ONE question per reply, and only when there is a natural opening. Never stack questions.
- "No answer" is always fine — never corner or push them.
- Match their energy. Tired/terse → shorter, gentler, fewer probes.
- Keep replies to 1–3 sentences.
- Do NOT ask about mood, energy, people/projects/tags, goals, or "reflections" — those are captured elsewhere.

${missingFields(checklist)}${hintsBlock(hints)}

Reply with ONLY this JSON: { "reply": string (your 1–3 sentence reply — reflect first, then at most one gentle probe), "covered": { "events": boolean, "decisions": boolean, "next_steps": boolean } }
Set each "covered" flag true only if the user's LATEST message actually addressed that field; false otherwise.`
}

/** One interview turn (small model): reads the natural history + current state, returns reply + what the latest message covered. */
export async function runInterviewTurn(args: {
  history: OpenAI.Chat.ChatCompletionMessageParam[]
  checklist: Checklist
  hints: InterviewHints
}): Promise<InterviewTurn> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildInterviewSystemPrompt(args.checklist, args.hints) },
    ...args.history,
  ]
  return callJsonValidated({
    messages,
    schema: interviewTurnSchema,
    model: env.LLM_SMALL_MODEL,
    maxTokens: 600,
    temperature: 0.6,
  })
}
