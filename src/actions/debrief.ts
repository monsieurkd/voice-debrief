'use server'

import { revalidatePath } from 'next/cache'
import { extractDebrief, ExtractionError } from '@/lib/extract'
import { generateOverview } from '@/lib/overview'
import { storeSession } from '@/lib/store'
import { updateRowText, addRowText, deleteRowEntity, setNextStepStatus } from '@/lib/mutations'
import { reclassifyRowEntity } from '@/lib/reclassify'
import type { ExtractionPayload } from '@/lib/extraction-schema'
import type { EntityType } from '@/lib/constants'

export type DebriefResult =
  | { ok: true; sessionId: number }
  | { ok: false; error: string }

/**
 * transcript -> extract (strong model, Zod-validated retry) -> transactional store.
 * On extraction failure we STILL persist the session (placeholder overview + raw
 * transcript, no children) so the user can add rows by hand — the transcript is
 * never lost.
 */
export async function runDebrief(transcript: string): Promise<DebriefResult> {
  const trimmed = transcript.trim()
  if (!trimmed) return { ok: false, error: 'Paste or type something first.' }

  // FAST model (overview) runs concurrently with the STRONG model (extraction).
  const overviewP = generateOverview(trimmed)

  let payload: ExtractionPayload | null = null
  try {
    payload = await extractDebrief(trimmed)
  } catch (e) {
    if (e instanceof ExtractionError) {
      payload = null // handled below: persist anyway
    } else {
      return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' }
    }
  }

  const fastOverview = await overviewP
  const overview = fastOverview ?? payload?.overview ?? 'Extraction failed — add your rows below.'

  const sessionId = await storeSession(
    trimmed,
    payload ?? { overview, events: [], reflections: [], decisions: [], next_steps: [] },
    { overview },
  )
  return { ok: true, sessionId }
}

/** Edit a block's text → UPDATE + source='user' + was_corrected=true. */
export async function updateRow(entityType: EntityType, id: number, text: string, sessionId: number) {
  await updateRowText(entityType, id, text)
  revalidatePath(`/session/${sessionId}`)
}

/** Add a new block → INSERT source='user'; returns the new binding. */
export async function addRow(
  entityType: EntityType,
  sessionId: number,
  text: string,
): Promise<{ entityType: EntityType; id: number }> {
  const id = await addRowText(entityType, sessionId, text)
  revalidatePath(`/session/${sessionId}`)
  return { entityType, id }
}

/** Delete a block → clean its tag_links, then delete the row. */
export async function deleteRow(entityType: EntityType, id: number, sessionId: number) {
  await deleteRowEntity(entityType, id)
  revalidatePath(`/session/${sessionId}`)
}

/** Reclassify a block → move the row to another table; returns the new binding. */
export async function reclassifyRow(
  from: EntityType,
  id: number,
  to: EntityType,
  sessionId: number,
): Promise<{ entityType: EntityType; id: number }> {
  const newId = await reclassifyRowEntity(from, id, to)
  revalidatePath(`/session/${sessionId}`)
  return { entityType: to, id: newId }
}

/** Mark a next_step open/done/skipped (the plan check-off). Revalidates Home. */
export async function setStepStatus(id: number, status: 'open' | 'done' | 'skipped') {
  await setNextStepStatus(id, status)
  revalidatePath('/')
}
