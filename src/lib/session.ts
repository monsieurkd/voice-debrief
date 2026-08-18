import { db } from '@/db/client'
import { sessions, events, reflections, decisions, nextSteps, goals, tags, tagLinks } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import type { EntityType } from '@/lib/constants'

export interface ViewTag {
  kind: string
  name: string
}

// One visible item in the doc. The {entityType, id} pair is the hidden 1:1 binding
// to a row — kept for interactivity, never rendered as text.
export interface ViewBlock {
  entityType: EntityType
  id: number
  text: string
  tags: ViewTag[]
  rationale?: string | null
  resolved?: boolean
  status?: string
  dueOn?: string | null
  goalTitle?: string | null
  kind?: string | null
  occurredAt?: Date | null
}

export interface LoadedSession {
  id: number
  startedAt: Date
  overview: string | null
  mood: string | null
  energy: number | null
  pace: string | null
  engagement: number | null
  tone: string | null
  transcript: string | null
  blocks: ViewBlock[]
  goals: { id: number; title: string; horizon: string | null; status: string }[]
}

async function tagsForEntities(entityType: EntityType, ids: number[]): Promise<Map<number, ViewTag[]>> {
  const m = new Map<number, ViewTag[]>()
  if (ids.length === 0) return m
  const rows = await db
    .select({ entity_id: tagLinks.entity_id, kind: tags.kind, name: tags.name })
    .from(tagLinks)
    .innerJoin(tags, eq(tagLinks.tag_id, tags.id))
    .where(and(eq(tagLinks.entity_type, entityType), inArray(tagLinks.entity_id, ids)))
  for (const r of rows) {
    const arr = m.get(r.entity_id) ?? []
    arr.push({ kind: r.kind, name: r.name })
    m.set(r.entity_id, arr)
  }
  return m
}

export async function loadSession(sessionId: number): Promise<LoadedSession | null> {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId))
  if (!session) return null

  const [evs, refs, decs, steps, goalRows] = await Promise.all([
    db.select().from(events).where(eq(events.session_id, sessionId)),
    db.select().from(reflections).where(eq(reflections.session_id, sessionId)),
    db.select().from(decisions).where(eq(decisions.session_id, sessionId)),
    db.select().from(nextSteps).where(eq(nextSteps.session_id, sessionId)),
    db.select().from(goals).where(eq(goals.user_id, session.user_id)),
  ])

  const [evTags, refTags, decTags, stepTags] = await Promise.all([
    tagsForEntities('event', evs.map((r) => r.id)),
    tagsForEntities('reflection', refs.map((r) => r.id)),
    tagsForEntities('decision', decs.map((r) => r.id)),
    tagsForEntities('next_step', steps.map((r) => r.id)),
  ])

  const goalTitleById = new Map(goalRows.map((g) => [g.id, g.title]))

  const blocks: ViewBlock[] = []
  for (const r of evs)
    blocks.push({ entityType: 'event', id: r.id, text: r.what, tags: evTags.get(r.id) ?? [], occurredAt: r.occurred_at })
  for (const r of refs)
    blocks.push({ entityType: 'reflection', id: r.id, text: r.content, tags: refTags.get(r.id) ?? [], kind: r.kind })
  for (const r of decs)
    blocks.push({
      entityType: 'decision',
      id: r.id,
      text: r.summary,
      tags: decTags.get(r.id) ?? [],
      rationale: r.rationale,
      resolved: r.resolved,
    })
  for (const r of steps)
    blocks.push({
      entityType: 'next_step',
      id: r.id,
      text: r.content,
      tags: stepTags.get(r.id) ?? [],
      status: r.status,
      dueOn: r.due_on,
      goalTitle: r.goal_id ? goalTitleById.get(r.goal_id) ?? null : null,
    })

  return {
    id: session.id,
    startedAt: session.started_at,
    overview: session.overview,
    mood: session.mood,
    energy: session.energy,
    pace: session.pace,
    engagement: session.engagement,
    tone: session.tone,
    transcript: session.transcript,
    blocks,
    goals: goalRows.map((g) => ({ id: g.id, title: g.title, horizon: g.horizon, status: g.status })),
  }
}
