import { db } from '@/db/client'
import { events, reflections, decisions, nextSteps, tagLinks } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { SECTION_BY_ENTITY, USER_ID, type EntityType } from '@/lib/constants'
import { resolveGoalId } from '@/lib/store'

// Pure DB mutations — no Next runtime deps, so they're testable from scripts.
// The server-action wrappers in actions/debrief.ts add revalidatePath on top.
// source='user' + was_corrected=true is the editable-viewer data-quality loop.

export async function updateRowText(entityType: EntityType, id: number, text: string) {
  const sec = SECTION_BY_ENTITY[entityType]
  const patch = { source: 'user' as const, was_corrected: true }
  switch (sec.key) {
    case 'events':
      await db.update(events).set({ what: text, ...patch }).where(eq(events.id, id))
      break
    case 'reflections':
      await db.update(reflections).set({ content: text, ...patch }).where(eq(reflections.id, id))
      break
    case 'decisions':
      await db.update(decisions).set({ summary: text, ...patch }).where(eq(decisions.id, id))
      break
    case 'next_steps':
      await db.update(nextSteps).set({ content: text, ...patch }).where(eq(nextSteps.id, id))
      break
  }
}

/**
 * Type-specific extras an add can restore (undo fidelity: delete → undo should
 * bring the row back as it was, not as bare text). All optional and validated
 * by the action layer before reaching here. Tag chips are NOT restorable here
 * (tag_links are polymorphic and cleaned on delete) — still a known gap.
 */
export interface AddRowExtras {
  status?: 'open' | 'done' | 'skipped'
  dueOn?: string | null
  goalTitle?: string | null
  rationale?: string | null
  resolved?: boolean
  kind?: string | null
  occurredAt?: Date | null
}

export async function addRowText(
  entityType: EntityType,
  sessionId: number,
  text: string,
  extras: AddRowExtras = {},
): Promise<number> {
  const sec = SECTION_BY_ENTITY[entityType]
  let id = 0
  switch (sec.key) {
    case 'events': {
      const [r] = await db
        .insert(events)
        .values({ session_id: sessionId, what: text, source: 'user', occurred_at: extras.occurredAt ?? null })
        .returning({ id: events.id })
      id = r!.id
      break
    }
    case 'reflections': {
      const [r] = await db
        .insert(reflections)
        .values({ session_id: sessionId, content: text, source: 'user', kind: extras.kind ?? null })
        .returning({ id: reflections.id })
      id = r!.id
      break
    }
    case 'decisions': {
      const [r] = await db
        .insert(decisions)
        .values({
          session_id: sessionId,
          summary: text,
          source: 'user',
          rationale: extras.rationale ?? null,
          resolved: extras.resolved ?? false,
        })
        .returning({ id: decisions.id })
      id = r!.id
      break
    }
    case 'next_steps': {
      const goalId = extras.goalTitle ? await resolveGoalId(db, USER_ID, extras.goalTitle) : null
      const [r] = await db
        .insert(nextSteps)
        .values({
          session_id: sessionId,
          content: text,
          source: 'user',
          status: extras.status ?? 'open',
          due_on: extras.dueOn ?? null,
          goal_id: goalId,
        })
        .returning({ id: nextSteps.id })
      id = r!.id
      break
    }
  }
  return id
}

export async function deleteRowEntity(entityType: EntityType, id: number) {
  // polymorphic tag_links has NO FK on entity_id → clean manually or we ship ghost tags.
  // One transaction: if the row delete fails, the tag_links delete rolls back too —
  // otherwise the row survived with its tags silently stripped.
  await db.transaction(async (tx) => {
    await tx.delete(tagLinks).where(and(eq(tagLinks.entity_type, entityType), eq(tagLinks.entity_id, id)))
    switch (SECTION_BY_ENTITY[entityType].key) {
      case 'events':
        await tx.delete(events).where(eq(events.id, id))
        break
      case 'reflections':
        await tx.delete(reflections).where(eq(reflections.id, id))
        break
      case 'decisions':
        await tx.delete(decisions).where(eq(decisions.id, id))
        break
      case 'next_steps':
        await tx.delete(nextSteps).where(eq(nextSteps.id, id))
        break
    }
  })
}

/** Toggle a next_step's status (used by the plan check-off). */
export async function setNextStepStatus(id: number, status: 'open' | 'done' | 'skipped') {
  await db.update(nextSteps).set({ status }).where(eq(nextSteps.id, id))
}
