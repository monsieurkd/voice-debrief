import { db } from '@/db/client'
import {
  sessions,
  events,
  reflections,
  decisions,
  nextSteps,
  goals,
  tags,
  tagLinks,
  userState,
} from '@/db/schema'
import { sql, and, eq } from 'drizzle-orm'
import type { ExtractionPayload, TagRef } from '@/lib/extraction-schema'
import { parseDateOnly, parseTimestamp } from '@/lib/dates'
import { USER_ID } from '@/lib/constants'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Upsert a tag by (user_id, kind, name) and return its id (inserted or existing). */
async function getTagId(tx: Tx, userId: number, ref: TagRef): Promise<number> {
  const [t] = await tx
    .insert(tags)
    .values({ user_id: userId, kind: ref.kind, name: ref.name })
    .onConflictDoUpdate({
      target: [tags.user_id, tags.kind, tags.name],
      set: { name: sql`excluded.name` }, // noop — just to satisfy onConflictDoUpdate and return the row
    })
    .returning({ id: tags.id })
  return t!.id
}

/** Wire a row to its tags via the polymorphic tag_links table. */
async function linkTags(
  tx: Tx,
  userId: number,
  entityType: 'event' | 'reflection' | 'decision' | 'next_step',
  entityId: number,
  refs: TagRef[] = [],
) {
  for (const ref of refs) {
    const tagId = await getTagId(tx, userId, ref)
    await tx
      .insert(tagLinks)
      .values({ tag_id: tagId, entity_type: entityType, entity_id: entityId })
      .onConflictDoNothing()
  }
}

/** Resolve a goal TITLE (case-insensitive) to an id, creating the goal if new. */
async function resolveGoalId(tx: Tx, userId: number, title: string): Promise<number> {
  const [existing] = await tx
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.user_id, userId), sql`lower(${goals.title}) = ${title.toLowerCase()}`))
    .limit(1)
  if (existing) return existing.id
  const [g] = await tx.insert(goals).values({ user_id: userId, title }).returning({ id: goals.id })
  return g!.id
}

/**
 * Persist a full session from a validated extraction payload, transactionally:
 * session row + all child rows + tags/tag_links + user_state adaptation.
 * All-or-nothing: any failure rolls the whole session back.
 */
export async function storeSession(
  transcript: string,
  payload: ExtractionPayload,
  opts: { userId?: number; overview?: string; startedAt?: Date } = {},
): Promise<number> {
  const userId = opts.userId ?? USER_ID
  return db.transaction(async (tx) => {
    const [session] = await tx
      .insert(sessions)
      .values({
        user_id: userId,
        transcript,
        started_at: opts.startedAt ?? new Date(),
        overview: opts.overview ?? payload.overview,
        mood: payload.mood ?? null,
        energy: payload.energy ?? null,
        pace: payload.pace ?? null,
        engagement: payload.engagement ?? null,
        tone: payload.tone ?? null,
      })
      .returning({ id: sessions.id })
    const sessionId = session!.id

    for (const e of payload.events) {
      const [row] = await tx
        .insert(events)
        .values({ session_id: sessionId, what: e.what, occurred_at: parseTimestamp(e.occurred_at) })
        .returning({ id: events.id })
      await linkTags(tx, userId, 'event', row!.id, e.tags)
    }
    for (const r of payload.reflections) {
      const [row] = await tx
        .insert(reflections)
        .values({ session_id: sessionId, content: r.content, kind: r.kind ?? null })
        .returning({ id: reflections.id })
      await linkTags(tx, userId, 'reflection', row!.id, r.tags)
    }
    for (const d of payload.decisions) {
      const [row] = await tx
        .insert(decisions)
        .values({
          session_id: sessionId,
          summary: d.summary,
          rationale: d.rationale ?? null,
          resolved: d.resolved,
        })
        .returning({ id: decisions.id })
      await linkTags(tx, userId, 'decision', row!.id, d.tags)
    }
    for (const s of payload.next_steps) {
      const goalId = s.goal ? await resolveGoalId(tx, userId, s.goal) : null
      const [row] = await tx
        .insert(nextSteps)
        .values({
          session_id: sessionId,
          content: s.content,
          status: s.status,
          due_on: parseDateOnly(s.due_on),
          goal_id: goalId,
        })
        .returning({ id: nextSteps.id })
      await linkTags(tx, userId, 'next_step', row!.id, s.tags)
    }

    // Adapt the single user_state row for the NEXT session to read.
    await tx
      .insert(userState)
      .values({
        user_id: userId,
        last_session_id: sessionId,
        last_mood: payload.mood ?? null,
        last_engagement: payload.engagement ?? null,
        preferred_pace: payload.pace ?? null,
        sessions_count: 1,
        open_threads: [], // TODO(later slice): unresolved-decision / open-next_step ids
      })
      .onConflictDoUpdate({
        target: userState.user_id,
        set: {
          last_session_id: sessionId,
          last_mood: payload.mood ?? null,
          last_engagement: payload.engagement ?? null,
          preferred_pace: payload.pace ?? null,
          sessions_count: sql`${userState.sessions_count} + 1`,
          updated_at: new Date(),
        },
      })

    return sessionId
  })
}
