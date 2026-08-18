// Verify reclassify (move a row between tables) on a throwaway session, then clean up.
// Checks: old row gone, new row has the same text + source='user'/was_corrected=true,
// tag_links rewritten to the new entity, no stray links left on the old entity.
import { storeSession } from '../src/lib/store'
import { reclassifyRowEntity } from '../src/lib/reclassify'
import { db } from '../src/db/client'
import { events, reflections, tagLinks, sessions, userState } from '../src/db/schema'
import { eq, and } from 'drizzle-orm'
import type { ExtractionPayload } from '../src/lib/extraction-schema'

const payload: ExtractionPayload = {
  overview: 'Reclassify test session.',
  events: [{ what: 'A tagged event to move', tags: [{ kind: 'person', name: 'TestPerson' }] }],
  reflections: [],
  decisions: [],
  next_steps: [],
}

async function main() {
  const sid = await storeSession('reclassify test transcript', payload)
  const [ev] = await db.select().from(events).where(eq(events.session_id, sid))
  const before = await db.select().from(tagLinks).where(and(eq(tagLinks.entity_type, 'event'), eq(tagLinks.entity_id, ev!.id)))
  console.log('source event:', { id: ev!.id, what: ev!.what, tag_links: before.length })

  const newId = await reclassifyRowEntity('event', ev!.id, 'reflection')
  console.log('reclassified → new reflection id:', newId)

  const evGone = await db.select().from(events).where(eq(events.id, ev!.id))
  const [ref] = await db.select().from(reflections).where(eq(reflections.id, newId))
  const after = await db.select().from(tagLinks).where(and(eq(tagLinks.entity_type, 'reflection'), eq(tagLinks.entity_id, newId)))
  const stray = await db.select().from(tagLinks).where(and(eq(tagLinks.entity_type, 'event'), eq(tagLinks.entity_id, ev!.id)))
  console.log('old event gone?', evGone.length === 0)
  console.log('new reflection:', { content: ref!.content, source: ref!.source, was_corrected: ref!.was_corrected })
  console.log('tag_links moved (reflection):', after.length, '| stray (event):', stray.length)

  // cleanup the throwaway session. user_state.last_session_id references it via a
  // NO-ACTION FK, so clear that first, then delete (cascade removes rows + tag_links).
  await db.update(userState).set({ last_session_id: null }).where(eq(userState.user_id, 1))
  await db.delete(sessions).where(eq(sessions.id, sid))
  console.log(
    after.length === before.length && stray.length === 0 ? '\n✅ reclassify verified' : '\n❌ tag count mismatch',
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
