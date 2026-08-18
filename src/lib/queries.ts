import { db } from '@/db/client'
import { sessions, nextSteps, goals } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { USER_ID } from '@/lib/constants'

export interface SessionSummary {
  id: number
  startedAt: Date
  overview: string | null
  mood: string | null
  energy: number | null
  tone: string | null
}

export interface PlanItem {
  id: number
  content: string
  dueOn: string | null
  goalTitle: string | null
  sessionId: number
  createdAt: Date
}

/** Recent debriefs for the journal/review list, newest first. */
export async function listSessions(limit = 20): Promise<SessionSummary[]> {
  return db
    .select({
      id: sessions.id,
      startedAt: sessions.started_at,
      overview: sessions.overview,
      mood: sessions.mood,
      energy: sessions.energy,
      tone: sessions.tone,
    })
    .from(sessions)
    .where(eq(sessions.user_id, USER_ID))
    .orderBy(desc(sessions.started_at))
    .limit(limit)
}

/** Open next_steps = "tomorrow's plan" (across all the user's sessions). */
export async function listOpenNextSteps(limit = 30): Promise<PlanItem[]> {
  const rows = await db
    .select({
      id: nextSteps.id,
      content: nextSteps.content,
      dueOn: nextSteps.due_on,
      goalTitle: goals.title,
      sessionId: nextSteps.session_id,
      createdAt: nextSteps.created_at,
    })
    .from(nextSteps)
    .leftJoin(goals, eq(nextSteps.goal_id, goals.id))
    .where(eq(nextSteps.status, 'open'))
    .orderBy(desc(nextSteps.created_at))
    .limit(limit)
  return rows
}
