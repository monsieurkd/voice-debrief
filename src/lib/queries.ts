import { db } from '@/db/client'
import { sessions, nextSteps, goals } from '@/db/schema'
import { eq, desc, and, or, isNull, gte } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { USER_ID } from '@/lib/constants'
import { todayInAppTz, isoMinusDays } from '@/lib/dates'

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

/**
 * "Tomorrow's plan" = open next_steps from the last 7 days — dated steps by
 * due_on, undated by creation. Without the window this became "every open
 * step forever": a step checked open three weeks ago headlined the plan
 * indefinitely and pushed fresh items past the limit. Older open steps stay
 * visible on their session pages.
 */
export async function listOpenNextSteps(limit = 30): Promise<PlanItem[]> {
  const cutoff = isoMinusDays(todayInAppTz(), 7)
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
    .where(
      and(
        eq(nextSteps.status, 'open'),
        or(
          gte(nextSteps.due_on, cutoff),
          and(isNull(nextSteps.due_on), gte(nextSteps.created_at, sql`now() - interval '7 days'`)),
        ),
      ),
    )
    .orderBy(desc(nextSteps.created_at))
    .limit(limit)
  return rows
}
