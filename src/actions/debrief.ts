'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { env } from '@/lib/env'
import { extractDebrief, ExtractionError } from '@/lib/extract'
import { generateOverview } from '@/lib/overview'
import { storeSession } from '@/lib/store'
import { updateRowText, addRowText, deleteRowEntity, setNextStepStatus, deleteSession } from '@/lib/mutations'
import { reclassifyRowEntity } from '@/lib/reclassify'
import { parseArgs } from '@/lib/action-args'
import { summarizeLlmError } from '@/lib/llm-errors'
import { buildSampleSessions } from '@/lib/sample-sessions'
import { buildDemoWeek, bakedDemoWeekThreads } from '@/lib/demo-week'
import { sampleTranscripts } from '@/lib/sample-transcripts'
import { generateThreads, loadThreadSessions, storeThreads } from '@/lib/threads'
import { checkRateLimit } from '@/lib/rate-limit'
import { currentUserOrGuest } from '@/lib/auth'
import { DEMO_LIMITS, RATE_WINDOW_MS } from '@/lib/constants'
import type { ExtractionPayload } from '@/lib/extraction-schema'
import type { EntityType } from '@/lib/constants'

export type DebriefResult =
  | { ok: true; sessionId: number }
  | { ok: false; error: string }

// Server-action args are client-controlled HTTP payloads — validate at runtime.
const entityTypeSchema = z.enum(['event', 'decision', 'reflection', 'next_step'])
const textSchema = z.string().trim().min(1).max(2000)
const idSchema = z.number().int().positive()

/**
 * transcript -> extract (strong model, Zod-validated retry) -> transactional store.
 * On extraction failure we STILL persist the session (placeholder overview with
 * the failure cause + raw transcript, no children) so the user can add rows by
 * hand — the transcript is never lost, and the failure is never silent.
 *
 * `fast: true` runs the whole extraction on the small (fast) model instead of
 * the strong one — several times quicker, at slightly lower structured
 * fidelity. Otherwise identical (same schema, same store, same failure-safe
 * persist).
 */
export async function runDebrief(transcriptInput: string, optsInput?: { fast?: boolean }): Promise<DebriefResult> {
  // Debrief-first: a visitor without an account debriefs as an anonymous guest;
  // their session is adopted onto a real account if they sign up/log in later.
  const user = await currentUserOrGuest()
  const {
    transcript,
    fast = false,
  } = parseArgs(
    z.object({ transcript: z.string().trim().min(1).max(20000), fast: z.boolean().optional() }),
    { transcript: transcriptInput, fast: optsInput?.fast },
    'runDebrief',
  )

  // Spend guardrail, keyed to the signed-in user (shared per-user windows
  // across serverless instances): the live AI path costs money per call.
  if (!(await checkRateLimit(`debrief:u:${user.id}`, DEMO_LIMITS.debriefsPerHour, RATE_WINDOW_MS))) {
    return {
      ok: false,
      error: `Demo limit reached — live debriefs are capped at ${DEMO_LIMITS.debriefsPerHour}/hour. Try the instant sample instead.`,
    }
  }

  // Config errors can never succeed — fail fast, store nothing.
  if (!env.LLM_API_KEY) {
    return { ok: false, error: 'LLM_API_KEY is not set. Add it to .env.local and try again — nothing was saved.' }
  }

  // FAST path (small model) when requested; otherwise the FAST model runs the
  // overview concurrently with the STRONG model doing the extraction.
  const overviewP = generateOverview(transcript)

  let payload: ExtractionPayload | null = null
  let failCause: string | null = null
  try {
    payload = await extractDebrief(transcript, { model: fast ? env.LLM_SMALL_MODEL : undefined })
  } catch (e) {
    if (e instanceof ExtractionError) {
      payload = null // handled below: persist anyway
      failCause = summarizeLlmError(e)
      console.error('[runDebrief] extraction failed:', e.message)
    } else {
      console.error('[runDebrief] unexpected error:', e)
      return { ok: false, error: 'Something went wrong while reading your debrief — please try again.' }
    }
  }

  const fastOverview = await overviewP
  const overview =
    fastOverview ??
    payload?.overview ??
    `Extraction failed (${failCause}) — your words are saved below. Add rows by hand, or run the debrief again.`

  let sessionId: number
  try {
    sessionId = await storeSession(
      transcript,
      payload ?? { overview, events: [], reflections: [], decisions: [], next_steps: [] },
      { userId: user.id, overview },
    )
  } catch (e) {
    console.error('[runDebrief] store failed:', e)
    return { ok: false, error: 'Could not save the debrief — the database is unreachable. Try again in a moment.' }
  }
  revalidatePath('/') // a new session changes Home (entries + possibly the plan)

  // Cross-day threads regenerate in the background once there is a week to
  // read — never blocks the redirect, and failure is logged, not shown.
  if (env.LLM_API_KEY) {
    after(async () => {
      try {
        const inputs = await loadThreadSessions(user.id)
        if (inputs.length >= 3) {
          const threads = await generateThreads(inputs)
          await storeThreads(user.id, inputs[inputs.length - 1]!.id, threads)
          revalidatePath('/')
        }
      } catch (e) {
        console.error('[runDebrief] background thread refresh failed:', e)
      }
    })
  }
  return { ok: true, sessionId }
}

/**
 * Demo mode: store a pre-baked sample session — same transactional store as a
 * real debrief, but no LLM call. Instant, and works with no API key configured.
 */
export async function runSampleDebrief(sampleIdInput: number): Promise<DebriefResult> {
  const user = await currentUserOrGuest()
  const { sampleId } = parseArgs(
    z.object({ sampleId: z.number().int().min(0).max(sampleTranscripts.length - 1) }),
    { sampleId: sampleIdInput },
    'runSampleDebrief',
  )
  // No LLM cost, but still capped per user so the demo DB can't be filled by a loop.
  if (!(await checkRateLimit(`sample:u:${user.id}`, DEMO_LIMITS.samplesPerHour, RATE_WINDOW_MS))) {
    return { ok: false, error: `Demo limit reached — samples are capped at ${DEMO_LIMITS.samplesPerHour}/hour. Come back later.` }
  }
  const sample = buildSampleSessions()[sampleId]
  let sessionId: number
  try {
    sessionId = await storeSession(sample.transcript, sample.payload, { userId: user.id, overview: sample.payload.overview })
  } catch (e) {
    console.error('[runSampleDebrief] store failed:', e)
    return { ok: false, error: 'Could not save the sample — the database is unreachable. Try again in a moment.' }
  }
  revalidatePath('/')
  return { ok: true, sessionId }
}

/**
 * Demo week: seed five backdated days of one story arc (no LLM calls) so the
 * journal opens looking lived-in — plans accumulating, threads forming.
 * Lands on Home (not a session page): the reveal is the journal itself.
 */
export async function runDemoWeek(): Promise<DebriefResult> {
  const user = await currentUserOrGuest()
  if (!(await checkRateLimit(`demoweek:u:${user.id}`, 3, RATE_WINDOW_MS))) {
    return { ok: false, error: 'Demo limit reached — the demo week can be loaded 3 times per hour. Come back later.' }
  }
  const week = buildDemoWeek() // oldest first
  let lastId = 0
  try {
    for (const day of week) {
      lastId = await storeSession(day.transcript, day.payload, {
        userId: user.id,
        overview: day.payload.overview,
        startedAt: day.startedAt,
      })
    }
    // bake the cross-day threads so the compounding is visible without a key
    await storeThreads(user.id, lastId, bakedDemoWeekThreads())
  } catch (e) {
    console.error('[runDemoWeek] store failed:', e)
    return { ok: false, error: 'Could not save the demo week — the database is unreachable. Try again in a moment.' }
  }
  revalidatePath('/')
  return { ok: true, sessionId: lastId }
}

/** Re-run the cross-day threads pass over the newest sessions (explicit refresh). */
export async function refreshThreads(): Promise<{ ok: boolean; error?: string }> {
  const user = await currentUserOrGuest()
  if (!(await checkRateLimit(`threads:u:${user.id}`, 5, RATE_WINDOW_MS))) {
    return { ok: false, error: 'Demo limit reached — thread refreshes are capped at 5/hour. Try again later.' }
  }
  if (!env.LLM_API_KEY) {
    return { ok: false, error: 'Threads need an API key — this demo is running keyless (instant samples still work).' }
  }
  try {
    const inputs = await loadThreadSessions(user.id)
    if (inputs.length < 2) {
      return { ok: false, error: 'Threads need at least two debriefs to connect — write another day first.' }
    }
    const threads = await generateThreads(inputs)
    await storeThreads(user.id, inputs[inputs.length - 1]!.id, threads)
  } catch (e) {
    console.error('[refreshThreads] failed:', e)
    return { ok: false, error: `Could not refresh threads — ${summarizeLlmError(e)}. Try again in a minute.` }
  }
  revalidatePath('/')
  return { ok: true }
}

/** Edit a block's text → UPDATE + source='user' + was_corrected=true. */
export async function updateRow(entityType: EntityType, id: number, text: string, sessionId: number) {
  const user = await currentUserOrGuest()
  const a = parseArgs(
    z.object({ entityType: entityTypeSchema, id: idSchema, text: textSchema, sessionId: idSchema }),
    { entityType, id, text, sessionId },
    'updateRow',
  )
  await updateRowText(a.entityType, a.id, a.text, user.id)
  revalidatePath(`/session/${a.sessionId}`)
}

// Optional add-row extras (undo fidelity): everything a delete→undo should
// restore beyond text. Nullable fields accept explicit null ("known absent").
const addExtrasSchema = z.object({
  status: z.enum(['open', 'done', 'skipped']).optional(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  goalTitle: z.string().trim().min(1).max(200).nullish(),
  rationale: z.string().trim().max(2000).nullish(),
  resolved: z.boolean().optional(),
  kind: z.string().trim().max(200).nullish(),
  occurredAt: z.date().nullish(),
})

/** Add a new block → INSERT source='user'; returns the new binding. */
export async function addRow(
  entityType: EntityType,
  sessionId: number,
  text: string,
  extrasInput?: z.infer<typeof addExtrasSchema>,
): Promise<{ entityType: EntityType; id: number }> {
  const user = await currentUserOrGuest()
  const a = parseArgs(
    z.object({
      entityType: entityTypeSchema,
      sessionId: idSchema,
      text: textSchema,
      extras: addExtrasSchema.default({}),
    }),
    { entityType, sessionId, text, extras: extrasInput },
    'addRow',
  )
  const id = await addRowText(a.entityType, a.sessionId, a.text, user.id, a.extras)
  revalidatePath(`/session/${a.sessionId}`)
  return { entityType: a.entityType, id }
}

/** Delete a block → clean its tag_links, then delete the row. */
export async function deleteRow(entityType: EntityType, id: number, sessionId: number) {
  const user = await currentUserOrGuest()
  const a = parseArgs(
    z.object({ entityType: entityTypeSchema, id: idSchema, sessionId: idSchema }),
    { entityType, id, sessionId },
    'deleteRow',
  )
  await deleteRowEntity(a.entityType, a.id, user.id)
  revalidatePath(`/session/${a.sessionId}`)
}

/** Reclassify a block → move the row to another table; returns the new binding. */
export async function reclassifyRow(
  from: EntityType,
  id: number,
  to: EntityType,
  sessionId: number,
): Promise<{ entityType: EntityType; id: number }> {
  const user = await currentUserOrGuest()
  const a = parseArgs(
    z.object({ from: entityTypeSchema, id: idSchema, to: entityTypeSchema, sessionId: idSchema }),
    { from, id, to, sessionId },
    'reclassifyRow',
  )
  const newId = await reclassifyRowEntity(a.from, a.id, a.to, user.id)
  revalidatePath(`/session/${a.sessionId}`)
  return { entityType: a.to, id: newId }
}

/** Mark a next_step open/done/skipped (the plan check-off). Revalidates Home. */
export async function setStepStatus(id: number, status: 'open' | 'done' | 'skipped') {
  const user = await currentUserOrGuest()
  const a = parseArgs(
    z.object({ id: idSchema, status: z.enum(['open', 'done', 'skipped']) }),
    { id, status },
    'setStepStatus',
  )
  await setNextStepStatus(a.id, a.status, user.id)
  revalidatePath('/')
}

/**
 * Delete a whole session + children (GDPR erasure unit). The doc is gone, so
 * this revalidates Home and the (now-404) session path. Throws on foreign ids.
 */
export async function deleteSessionRow(sessionIdInput: number) {
  const user = await currentUserOrGuest()
  const a = parseArgs(z.object({ sessionId: idSchema }), { sessionId: sessionIdInput }, 'deleteSessionRow')
  await deleteSession(a.sessionId, user.id)
  revalidatePath('/')
  revalidatePath(`/session/${a.sessionId}`)
}
