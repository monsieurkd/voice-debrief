'use server'

import type OpenAI from 'openai'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { userState } from '@/db/schema'
import { USER_ID } from '@/lib/constants'
import { runInterviewTurn, type Checklist, type InterviewHints } from '@/lib/interview'

export type ChatMsg = { role: 'user' | 'assistant'; content: string }

/**
 * One guided-interview turn. Reads user_state for adaptation hints, runs the small-model
 * driver, and returns the reply plus the merged checklist (what's covered so far).
 */
export async function interviewTurnAction(args: {
  history: ChatMsg[]
  checklist: Checklist
}): Promise<{ reply: string; checklist: Checklist }> {
  const [us] = await db.select().from(userState).where(eq(userState.user_id, USER_ID))
  const hints: InterviewHints = {
    mood: us?.last_mood ?? null,
    engagement: us?.last_engagement ?? null,
    pace: us?.preferred_pace ?? null,
  }
  const history: OpenAI.Chat.ChatCompletionMessageParam[] = args.history.map((m) => ({
    role: m.role,
    content: m.content,
  }))
  const turn = await runInterviewTurn({ history, checklist: args.checklist, hints })
  return {
    reply: turn.reply,
    checklist: {
      events: args.checklist.events || turn.covered.events,
      decisions: args.checklist.decisions || turn.covered.decisions,
      next_steps: args.checklist.next_steps || turn.covered.next_steps,
    },
  }
}
