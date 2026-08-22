'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { userState } from '@/db/schema'
import { DEMO_LIMITS, RATE_WINDOW_MS } from '@/lib/constants'
import { parseArgs } from '@/lib/action-args'
import { checkRateLimit } from '@/lib/rate-limit'
import { currentUserOrGuest } from '@/lib/auth'
import { runInterviewTurn, type Checklist, type InterviewHints } from '@/lib/interview'

export type ChatMsg = { role: 'user' | 'assistant'; content: string }

// Client-controlled payload: roles are re-validated at runtime (a forged
// 'system' role must never reach the model) and both depth and message size
// are bounded — this endpoint costs money per call.
const chatMsgSchema = z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) })
const turnArgsSchema = z.object({
  history: z.array(chatMsgSchema).max(60),
  checklist: z.object({ events: z.boolean(), decisions: z.boolean(), next_steps: z.boolean() }),
})

const DRIVER_WINDOW = 40 // recent turns the driver model actually needs

/**
 * One guided-interview turn. Reads user_state for adaptation hints, runs the small-model
 * driver, and returns the reply plus the merged checklist (what's covered so far).
 * Errors come back as `error` (not thrown) — Next masks thrown messages in prod,
 * and the client must be able to show why a turn was refused.
 */
export async function interviewTurnAction(args: {
  history: ChatMsg[]
  checklist: Checklist
}): Promise<{ reply: string; checklist: Checklist; error?: string }> {
  // Debrief-first: a visitor interviews as a guest; their session adopts onto
  // an account if they sign up later. currentUserOrGuest never fails (a guest
  // user is minted on first turn), so per-date rate limiting keys on that id.
  const user = await currentUserOrGuest()
  const input = parseArgs(turnArgsSchema, args, 'interviewTurn')

  // Spend guardrail, keyed to the signed-in user: the driver costs money per turn.
  if (!(await checkRateLimit(`interview:u:${user.id}`, DEMO_LIMITS.interviewTurnsPerHour, RATE_WINDOW_MS))) {
    return {
      reply: '',
      checklist: input.checklist,
      error: `Demo limit reached — interview turns are capped at ${DEMO_LIMITS.interviewTurnsPerHour}/hour. Finish up, or come back later.`,
    }
  }

  const [us] = await db.select().from(userState).where(eq(userState.user_id, user.id))
  const hints: InterviewHints = {
    mood: us?.last_mood ?? null,
    engagement: us?.last_engagement ?? null,
    pace: us?.preferred_pace ?? null,
  }
  const history = input.history.slice(-DRIVER_WINDOW).map((m) => ({ role: m.role, content: m.content }))
  const turn = await runInterviewTurn({ history, checklist: input.checklist, hints })
  return {
    reply: turn.reply,
    checklist: {
      events: input.checklist.events || turn.covered.events,
      decisions: input.checklist.decisions || turn.covered.decisions,
      next_steps: input.checklist.next_steps || turn.covered.next_steps,
    },
  }
}
