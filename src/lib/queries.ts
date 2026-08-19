import { db } from '@/db/client'
import { sessions, nextSteps, goals, tags } from '@/db/schema'
import { eq, desc, and, or, isNull, gte, asc } from 'drizzle-orm'
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

// ── Archive (/archive) — every session, searchable ─────────────

export interface ArchiveFilters {
  /** Plain-text search; matched with websearch_to_tsquery (phrases, -exclusions). */
  q?: string
  /** Tag name; a session matches when any of its rows carries the tag. */
  tag?: string
  page?: number
  pageSize?: number
}

export interface ArchiveResult {
  rows: SessionSummary[]
  total: number
}

// A session "has tag X" = any of its four row tables carries a tag_link to X.
// tag_links is polymorphic (entity_id has no FK), so this is a UNION across
// the four children — one fragment, resolved inside the query.
function sessionsWithTag(tag: string) {
  const tagId = sql`(SELECT id FROM tags WHERE user_id = ${USER_ID} AND name = ${tag})`
  return sql`${sessions.id} IN (
    SELECT e.session_id FROM tag_links tl JOIN events e
      ON tl.entity_type = 'event' AND tl.entity_id = e.id WHERE tl.tag_id = ${tagId}
    UNION
    SELECT r.session_id FROM tag_links tl JOIN reflections r
      ON tl.entity_type = 'reflection' AND tl.entity_id = r.id WHERE tl.tag_id = ${tagId}
    UNION
    SELECT d.session_id FROM tag_links tl JOIN decisions d
      ON tl.entity_type = 'decision' AND tl.entity_id = d.id WHERE tl.tag_id = ${tagId}
    UNION
    SELECT n.session_id FROM tag_links tl JOIN next_steps n
      ON tl.entity_type = 'next_step' AND tl.entity_id = n.id WHERE tl.tag_id = ${tagId}
  )`
}

/**
 * The archive listing: Home caps at 20 with no way back in time; this pages
 * through everything. Search goes through the sessions.search_tsv generated
 * column. An empty tsquery (blank query, or stopwords only) matches nothing —
 * those queries fall back to ILIKE, which for '' degenerates to "no filter".
 */
export async function listArchiveSessions(filters: ArchiveFilters = {}): Promise<ArchiveResult> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20))
  const q = filters.q?.trim() ?? ''
  const tag = filters.tag?.trim() ?? ''

  const conditions = [eq(sessions.user_id, USER_ID)]
  if (q) {
    conditions.push(sql`(
      ${sessions.search_tsv} @@ websearch_to_tsquery('english', ${q})
      OR (
        websearch_to_tsquery('english', ${q}) = ''::tsquery
        AND (${sessions.overview} ILIKE ${'%' + q + '%'} OR ${sessions.transcript} ILIKE ${'%' + q + '%'})
      )
    )`)
  }
  if (tag) conditions.push(sessionsWithTag(tag))
  const where = and(...conditions)

  const summary = {
    id: sessions.id,
    startedAt: sessions.started_at,
    overview: sessions.overview,
    mood: sessions.mood,
    energy: sessions.energy,
    tone: sessions.tone,
  }
  const [rows, counted] = await Promise.all([
    db
      .select(summary)
      .from(sessions)
      .where(where)
      .orderBy(desc(sessions.started_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(sessions).where(where),
  ])
  return { rows, total: counted[0]?.count ?? 0 }
}

/** Chip source for the archive tag filter: the user's tag names, deduped. */
export async function listUserTagNames(limit = 30): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name })
    .from(tags)
    .where(eq(tags.user_id, USER_ID))
    .groupBy(tags.name)
    .orderBy(asc(tags.name))
    .limit(limit)
  return rows.map((r) => r.name)
}
