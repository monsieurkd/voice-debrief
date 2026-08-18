'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { env } from '@/lib/env'
import { extractDebrief, ExtractionError } from '@/lib/extract'
import { generateOverview } from '@/lib/overview'
import { storeSession } from '@/lib/store'
import { updateRowText, addRowText, deleteRowEntity, setNextStepStatus } from '@/lib/mutations'
import { reclassifyRowEntity } from '@/lib/reclassify'
import { parseArgs } from '@/lib/action-args'
import { summarizeLlmError } from '@/lib/llm-errors'
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
 */
export async function runDebrief(transcriptInput: string): Promise<DebriefResult> {
  const { transcript } = parseArgs(z.object({ transcript: z.string().trim().min(1).max(20000) }), { transcript: transcriptInput }, 'runDebrief')

  // Config errors can never succeed — fail fast, store nothing.
  if (!env.LLM_API_KEY) {
    return { ok: false, error: 'LLM_API_KEY is not set. Add it to .env.local and try again — nothing was saved.' }
  }

  // FAST model (overview) runs concurrently with the STRONG model (extraction).
  const overviewP = generateOverview(transcript)

  let payload: ExtractionPayload | null = null
  let failCause: string | null = null
  try {
    payload = await extractDebrief(transcript)
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
      { overview },
    )
  } catch (e) {
    console.error('[runDebrief] store failed:', e)
    return { ok: false, error: 'Could not save the debrief — the database is unreachable. Try again in a moment.' }
  }
  revalidatePath('/') // a new session changes Home (entries + possibly the plan)
  return { ok: true, sessionId }
}

/** Edit a block's text → UPDATE + source='user' + was_corrected=true. */
export async function updateRow(entityType: EntityType, id: number, text: string, sessionId: number) {
  const a = parseArgs(
    z.object({ entityType: entityTypeSchema, id: idSchema, text: textSchema, sessionId: idSchema }),
    { entityType, id, text, sessionId },
    'updateRow',
  )
  await updateRowText(a.entityType, a.id, a.text)
  revalidatePath(`/session/${a.sessionId}`)
}

/** Add a new block → INSERT source='user'; returns the new binding. */
export async function addRow(
  entityType: EntityType,
  sessionId: number,
  text: string,
): Promise<{ entityType: EntityType; id: number }> {
  const a = parseArgs(
    z.object({ entityType: entityTypeSchema, sessionId: idSchema, text: textSchema }),
    { entityType, sessionId, text },
    'addRow',
  )
  const id = await addRowText(a.entityType, a.sessionId, a.text)
  revalidatePath(`/session/${a.sessionId}`)
  return { entityType: a.entityType, id }
}

/** Delete a block → clean its tag_links, then delete the row. */
export async function deleteRow(entityType: EntityType, id: number, sessionId: number) {
  const a = parseArgs(
    z.object({ entityType: entityTypeSchema, id: idSchema, sessionId: idSchema }),
    { entityType, id, sessionId },
    'deleteRow',
  )
  await deleteRowEntity(a.entityType, a.id)
  revalidatePath(`/session/${a.sessionId}`)
}

/** Reclassify a block → move the row to another table; returns the new binding. */
export async function reclassifyRow(
  from: EntityType,
  id: number,
  to: EntityType,
  sessionId: number,
): Promise<{ entityType: EntityType; id: number }> {
  const a = parseArgs(
    z.object({ from: entityTypeSchema, id: idSchema, to: entityTypeSchema, sessionId: idSchema }),
    { from, id, to, sessionId },
    'reclassifyRow',
  )
  const newId = await reclassifyRowEntity(a.from, a.id, a.to)
  revalidatePath(`/session/${a.sessionId}`)
  return { entityType: a.to, id: newId }
}

/** Mark a next_step open/done/skipped (the plan check-off). Revalidates Home. */
export async function setStepStatus(id: number, status: 'open' | 'done' | 'skipped') {
  const a = parseArgs(
    z.object({ id: idSchema, status: z.enum(['open', 'done', 'skipped']) }),
    { id, status },
    'setStepStatus',
  )
  await setNextStepStatus(a.id, a.status)
  revalidatePath('/')
}
