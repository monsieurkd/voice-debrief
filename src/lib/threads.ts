import { z } from 'zod'
import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { insights, sessions, events, decisions, nextSteps } from '@/db/schema'
import { env } from './env'
import { callJsonValidated, type Complete } from './llm-call'
import { formatDate } from './dates'

/** "Fri 14" — deterministic (Intl option ordering is not). */
export function dayLabel(d: Date): string {
  return `${formatDate(d, { weekday: 'short' })} ${formatDate(d, { day: 'numeric' })}`
}

/**
 * Threads — the cross-day insight pass. The whole product thesis is "a
 * debrief compounds"; threads are where that becomes VISIBLE: the strong model
 * reads recent sessions and names what connects across days, grounded in
 * dates. Kinds: pattern (recurring), progress (something moved), nudge (open
 * loop that needs attention).
 */

export const threadSchema = z.object({
  title: z.string().min(3).max(80),
  detail: z.string().min(1).max(400),
  kind: z.enum(['pattern', 'progress', 'nudge']),
  dates: z.array(z.string().max(20)).max(6).default([]),
})
export type Thread = z.infer<typeof threadSchema>

const threadsPayload = z.object({ threads: z.array(threadSchema).min(1).max(4) })

/** What the model sees per session — compact, structured, date-labelled. */
export interface ThreadSessionInput {
  id: number
  startedAt: Date
  overview: string | null
  events: string[]
  decisions: string[]
  nextSteps: string[]
}

const SYSTEM_PROMPT = `You read someone's recent daily debriefs and name what CONNECTS ACROSS DAYS — the threads a single day can't show. You are not a therapist and not a coach: no advice, no "you should", no praise. You are precise and warm.

Rules:
- Find 2 to 4 threads. A thread MUST span at least two sessions; never invent one from a single day.
- Ground every thread in real days: list the dates it draws from, in "Fri 14" style (short weekday, then day number).
- Kinds: "pattern" (something recurring), "progress" (something that visibly moved), "nudge" (an open loop that needs attention soon).
- Titles: max 8 words, concrete, name the actual thing (a person, a project, a habit) — never "a pattern to watch".
- Details: 1-2 sentences, specific evidence from the days. Quote the person's own phrasing when it lands.
- If the days are genuinely disconnected, return fewer threads rather than vague ones.

Reply with ONLY this JSON: { "threads": [ { "title": string, "detail": string, "kind": "pattern"|"progress"|"nudge", "dates": string[] } ] }`

export function buildThreadsUserPrompt(sessions: ThreadSessionInput[]): string {
  const blocks = sessions.map((s) => {
    const lines = [`[${dayLabel(s.startedAt)}] ${s.overview ?? '(no overview)'}`]
    for (const e of s.events) lines.push(`- event: ${e}`)
    for (const d of s.decisions) lines.push(`- decision: ${d}`)
    for (const n of s.nextSteps) lines.push(`- next: ${n}`)
    return lines.slice(0, 12).join('\n') // per-session cap keeps the prompt bounded
  })
  return `Recent debriefs, oldest to newest:\n\n${blocks.join('\n\n')}`
}

/** Strong-model pass over recent sessions → validated threads. */
export async function generateThreads(
  sessions: ThreadSessionInput[],
  opts: { complete?: Complete } = {},
): Promise<Thread[]> {
  if (!opts.complete && !env.LLM_API_KEY) throw new Error('LLM_API_KEY is not set.')
  const res = await callJsonValidated({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildThreadsUserPrompt(sessions) },
    ],
    schema: threadsPayload,
    model: env.LLM_MODEL,
    maxTokens: 1500,
    temperature: 0.4,
    complete: opts.complete,
  })
  return res.threads
}

export interface StoredThread extends Thread {
  id: number
}

/**
 * Replace the user's current threads (latest snapshot wins — the panel shows
 * "threads this week", not history) and anchor them to the newest session.
 */
export async function storeThreads(userId: number, sourceSessionId: number, threads: Thread[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(insights).where(eq(insights.user_id, userId))
    for (const t of threads) {
      await tx.insert(insights).values({
        user_id: userId,
        source_session_id: sourceSessionId,
        content: t.detail,
        related: { title: t.title, kind: t.kind, dates: t.dates },
      })
    }
  })
}

export async function listThreads(userId: number, limit = 4): Promise<StoredThread[]> {
  const rows = await db
    .select()
    .from(insights)
    .where(eq(insights.user_id, userId))
    .orderBy(desc(insights.id))
    .limit(limit)
  return rows.map((r) => {
    const rel = (r.related ?? {}) as { title?: string; kind?: Thread['kind']; dates?: string[] }
    return {
      id: r.id,
      title: rel.title ?? 'Thread',
      detail: r.content,
      kind: rel.kind ?? 'pattern',
      dates: rel.dates ?? [],
    }
  })
}

/** Load the newest `limit` sessions (oldest first) shaped for the threads pass. */
export async function loadThreadSessions(userId: number, limit = 6): Promise<ThreadSessionInput[]> {
  const recent = await db
    .select({ id: sessions.id, startedAt: sessions.started_at, overview: sessions.overview })
    .from(sessions)
    .where(eq(sessions.user_id, userId))
    .orderBy(desc(sessions.started_at))
    .limit(limit)
  recent.reverse() // oldest → newest, the order the prompt expects
  if (recent.length === 0) return []

  const ids = recent.map((s) => s.id)
  const [evs, decs, steps] = await Promise.all([
    db.select({ sessionId: events.session_id, what: events.what }).from(events).where(inArray(events.session_id, ids)),
    db.select({ sessionId: decisions.session_id, summary: decisions.summary, resolved: decisions.resolved }).from(decisions).where(inArray(decisions.session_id, ids)),
    db.select({ sessionId: nextSteps.session_id, content: nextSteps.content, status: nextSteps.status }).from(nextSteps).where(inArray(nextSteps.session_id, ids)),
  ])
  const byId = new Map(
    recent.map((s) => [
      s.id,
      { id: s.id, startedAt: s.startedAt, overview: s.overview, events: [], decisions: [], nextSteps: [] } satisfies ThreadSessionInput,
    ]),
  )
  const put = (sid: number, line: (s: ThreadSessionInput) => void) => {
    const s = byId.get(sid)
    if (s) line(s)
  }
  for (const e of evs) put(e.sessionId, (s) => s.events.push(e.what))
  for (const d of decs) put(d.sessionId, (s) => s.decisions.push(`${d.resolved ? '' : 'OPEN: '}${d.summary}`))
  for (const n of steps) put(n.sessionId, (s) => n.status === 'open' && s.nextSteps.push(n.content))
  return recent.map((s) => byId.get(s.id)!)
}
