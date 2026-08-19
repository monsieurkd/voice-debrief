import { db } from '@/db/client'
import { sessions, events, reflections, decisions, nextSteps, tagLinks } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { SECTION_BY_ENTITY, type EntityType } from '@/lib/constants'

// Pure DB mutations — no Next runtime deps, so they're testable from scripts.
// The server-action wrappers in actions/debrief.ts add revalidatePath on top.
// source='user' + was_corrected=true is the editable-viewer data-quality loop.
//
// TENANCY: every function takes userId and scopes the write to rows whose
// session belongs to that user — an id from another account fails loudly
// (RowOwnershipError), never a silent cross-tenant write.

/** Thrown when the target row/session belongs to a different user (or is gone). */
export class RowOwnershipError extends Error {
  constructor() {
    super('Row not found for this user')
    this.name = 'RowOwnershipError'
  }
}

/** Subquery: session ids owned by `userId` — composable into any WHERE. */
export function ownedSessionIds(userId: number) {
  return db.select({ id: sessions.id }).from(sessions).where(eq(sessions.user_id, userId))
}

export async function updateRowText(entityType: EntityType, id: number, text: string, userId: number) {
  const sec = SECTION_BY_ENTITY[entityType]
  const patch = { source: 'user' as const, was_corrected: true }
  // .returning() is the authz check: 0 rows = the id belongs to another user.
  let rows: { id: number }[]
  switch (sec.key) {
    case 'events':
      rows = await db
        .update(events)
        .set({ what: text, ...patch })
        .where(and(eq(events.id, id), inArray(events.session_id, ownedSessionIds(userId))))
        .returning({ id: events.id })
      break
    case 'reflections':
      rows = await db
        .update(reflections)
        .set({ content: text, ...patch })
        .where(and(eq(reflections.id, id), inArray(reflections.session_id, ownedSessionIds(userId))))
        .returning({ id: reflections.id })
      break
    case 'decisions':
      rows = await db
        .update(decisions)
        .set({ summary: text, ...patch })
        .where(and(eq(decisions.id, id), inArray(decisions.session_id, ownedSessionIds(userId))))
        .returning({ id: decisions.id })
      break
    case 'next_steps':
      rows = await db
        .update(nextSteps)
        .set({ content: text, ...patch })
        .where(and(eq(nextSteps.id, id), inArray(nextSteps.session_id, ownedSessionIds(userId))))
        .returning({ id: nextSteps.id })
      break
  }
  if (!rows || rows.length === 0) throw new RowOwnershipError()
}

export async function addRowText(entityType: EntityType, sessionId: number, text: string, userId: number): Promise<number> {
  // Writing into someone else's session is a cross-tenant row — refuse first.
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.user_id, userId)))
  if (!session) throw new RowOwnershipError()

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

/** session.user_id behind a child row, via the child table's session_id. */
export async function rowOwner(
  tx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
  entityType: EntityType,
  id: number,
): Promise<number | null> {
  switch (entityType) {
    case 'event': {
      const [r] = await tx
        .select({ owner: sessions.user_id })
        .from(events)
        .innerJoin(sessions, eq(events.session_id, sessions.id))
        .where(eq(events.id, id))
      return r?.owner ?? null
    }
    case 'reflection': {
      const [r] = await tx
        .select({ owner: sessions.user_id })
        .from(reflections)
        .innerJoin(sessions, eq(reflections.session_id, sessions.id))
        .where(eq(reflections.id, id))
      return r?.owner ?? null
    }
    case 'decision': {
      const [r] = await tx
        .select({ owner: sessions.user_id })
        .from(decisions)
        .innerJoin(sessions, eq(decisions.session_id, sessions.id))
        .where(eq(decisions.id, id))
      return r?.owner ?? null
    }
    case 'next_step': {
      const [r] = await tx
        .select({ owner: sessions.user_id })
        .from(nextSteps)
        .innerJoin(sessions, eq(nextSteps.session_id, sessions.id))
        .where(eq(nextSteps.id, id))
      return r?.owner ?? null
    }
  }
}

export async function deleteRowEntity(entityType: EntityType, id: number, userId: number) {
  // polymorphic tag_links has NO FK on entity_id → clean manually or we ship ghost tags.
  // One transaction: the ownership check, tag cleanup and row delete commit or
  // roll back together — a foreign id can never strip another user's tags.
  await db.transaction(async (tx) => {
    const owner = await rowOwner(tx, entityType, id)
    if (owner !== userId) throw new RowOwnershipError()

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
export async function setNextStepStatus(id: number, status: 'open' | 'done' | 'skipped', userId: number) {
  const rows = await db
    .update(nextSteps)
    .set({ status })
    .where(and(eq(nextSteps.id, id), inArray(nextSteps.session_id, ownedSessionIds(userId))))
    .returning({ id: nextSteps.id })
  if (rows.length === 0) throw new RowOwnershipError()
}

/**
 * Delete a whole session (GDPR erasure unit): children cascade via FK, but
 * polymorphic tag_links have NO FK on entity_id — their rows for each child
 * id are removed first, all in one transaction with the ownership check.
 * user_state.last_session_id self-nulls (ON DELETE SET NULL).
 */
export async function deleteSession(sessionId: number, userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [session] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.user_id, userId)))
    if (!session) throw new RowOwnershipError()

    const childIds = [
      [await tx.select({ id: events.id }).from(events).where(eq(events.session_id, sessionId)), 'event'],
      [await tx.select({ id: reflections.id }).from(reflections).where(eq(reflections.session_id, sessionId)), 'reflection'],
      [await tx.select({ id: decisions.id }).from(decisions).where(eq(decisions.session_id, sessionId)), 'decision'],
      [await tx.select({ id: nextSteps.id }).from(nextSteps).where(eq(nextSteps.session_id, sessionId)), 'next_step'],
    ] as const
    for (const [ids, entityType] of childIds) {
      if (ids.length > 0) {
        await tx
          .delete(tagLinks)
          .where(and(eq(tagLinks.entity_type, entityType), inArray(tagLinks.entity_id, ids.map((r) => r.id))))
      }
    }
    await tx.delete(sessions).where(eq(sessions.id, sessionId))
  })
}
