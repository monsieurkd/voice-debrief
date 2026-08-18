import { db } from '@/db/client'
import { events, reflections, decisions, nextSteps, tagLinks } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type { EntityType } from '@/lib/constants'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

function assertNever(et: never): never {
  throw new Error(`unknown entity type: ${et}`)
}

// Reclassify = move a row BETWEEN tables. Different tables have different columns,
// so it's read→map→insert-new→rewrite tag_links→delete-old in ONE transaction,
// never an UPDATE. The primary text survives; type-specific extras are dropped;
// tags are carried over by rewriting tag_links to the new (entity_type, entity_id).

async function readSource(tx: Tx, et: EntityType, id: number): Promise<{ text: string; sessionId: number }> {
  switch (et) {
    case 'event':
      return await tx.select({ text: events.what, sid: events.session_id }).from(events).where(eq(events.id, id)).then(([r]) => ({ text: r!.text, sessionId: r!.sid }))
    case 'reflection':
      return await tx.select({ text: reflections.content, sid: reflections.session_id }).from(reflections).where(eq(reflections.id, id)).then(([r]) => ({ text: r!.text, sessionId: r!.sid }))
    case 'decision':
      return await tx.select({ text: decisions.summary, sid: decisions.session_id }).from(decisions).where(eq(decisions.id, id)).then(([r]) => ({ text: r!.text, sessionId: r!.sid }))
    case 'next_step':
      return await tx.select({ text: nextSteps.content, sid: nextSteps.session_id }).from(nextSteps).where(eq(nextSteps.id, id)).then(([r]) => ({ text: r!.text, sessionId: r!.sid }))
    default:
      return assertNever(et)
  }
}

async function insertTarget(tx: Tx, et: EntityType, sessionId: number, text: string): Promise<number> {
  const v = { source: 'user' as const, was_corrected: true }
  switch (et) {
    case 'event': {
      const [r] = await tx.insert(events).values({ session_id: sessionId, what: text, ...v }).returning({ id: events.id })
      return r!.id
    }
    case 'reflection': {
      const [r] = await tx.insert(reflections).values({ session_id: sessionId, content: text, ...v }).returning({ id: reflections.id })
      return r!.id
    }
    case 'decision': {
      const [r] = await tx.insert(decisions).values({ session_id: sessionId, summary: text, ...v }).returning({ id: decisions.id })
      return r!.id
    }
    case 'next_step': {
      const [r] = await tx.insert(nextSteps).values({ session_id: sessionId, content: text, ...v }).returning({ id: nextSteps.id })
      return r!.id
    }
    default:
      return assertNever(et)
  }
}

async function deleteSource(tx: Tx, et: EntityType, id: number): Promise<void> {
  switch (et) {
    case 'event':
      await tx.delete(events).where(eq(events.id, id))
      return
    case 'reflection':
      await tx.delete(reflections).where(eq(reflections.id, id))
      return
    case 'decision':
      await tx.delete(decisions).where(eq(decisions.id, id))
      return
    case 'next_step':
      await tx.delete(nextSteps).where(eq(nextSteps.id, id))
      return
    default:
      return assertNever(et)
  }
}

/** Move a row from one entity type to another. Returns the new row's id. */
export async function reclassifyRowEntity(from: EntityType, id: number, to: EntityType): Promise<number> {
  if (from === to) return id
  return db.transaction(async (tx) => {
    const { text, sessionId } = await readSource(tx, from, id)
    const newId = await insertTarget(tx, to, sessionId, text)

    // polymorphic tag_links: rewrite entity_type + entity_id to the new row
    const links = await tx
      .select({ tagId: tagLinks.tag_id })
      .from(tagLinks)
      .where(and(eq(tagLinks.entity_type, from), eq(tagLinks.entity_id, id)))
    if (links.length) {
      await tx
        .insert(tagLinks)
        .values(links.map((l) => ({ tag_id: l.tagId, entity_type: to, entity_id: newId })))
        .onConflictDoNothing()
      await tx.delete(tagLinks).where(and(eq(tagLinks.entity_type, from), eq(tagLinks.entity_id, id)))
    }

    await deleteSource(tx, from, id)
    return newId
  })
}
