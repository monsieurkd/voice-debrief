import { db } from '@/db/client'
import { events, reflections, decisions, nextSteps, tagLinks } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { SECTION_BY_ENTITY, type EntityType } from '@/lib/constants'

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

export async function addRowText(entityType: EntityType, sessionId: number, text: string): Promise<number> {
  const sec = SECTION_BY_ENTITY[entityType]
  let id = 0
  switch (sec.key) {
    case 'events': {
      const [r] = await db.insert(events).values({ session_id: sessionId, what: text, source: 'user' }).returning({ id: events.id })
      id = r!.id
      break
    }
    case 'reflections': {
      const [r] = await db.insert(reflections).values({ session_id: sessionId, content: text, source: 'user' }).returning({ id: reflections.id })
      id = r!.id
      break
    }
    case 'decisions': {
      const [r] = await db.insert(decisions).values({ session_id: sessionId, summary: text, source: 'user' }).returning({ id: decisions.id })
      id = r!.id
      break
    }
    case 'next_steps': {
      const [r] = await db.insert(nextSteps).values({ session_id: sessionId, content: text, source: 'user' }).returning({ id: nextSteps.id })
      id = r!.id
      break
    }
  }
  return id
}

export async function deleteRowEntity(entityType: EntityType, id: number) {
  // polymorphic tag_links has NO FK on entity_id → clean manually or we ship ghost tags.
  await db.delete(tagLinks).where(and(eq(tagLinks.entity_type, entityType), eq(tagLinks.entity_id, id)))
  const sec = SECTION_BY_ENTITY[entityType]
  switch (sec.key) {
    case 'events':
      await db.delete(events).where(eq(events.id, id))
      break
    case 'reflections':
      await db.delete(reflections).where(eq(reflections.id, id))
      break
    case 'decisions':
      await db.delete(decisions).where(eq(decisions.id, id))
      break
    case 'next_steps':
      await db.delete(nextSteps).where(eq(nextSteps.id, id))
      break
  }
}

/** Toggle a next_step's status (used by the plan check-off). */
export async function setNextStepStatus(id: number, status: 'open' | 'done' | 'skipped') {
  await db.update(nextSteps).set({ status }).where(eq(nextSteps.id, id))
}
