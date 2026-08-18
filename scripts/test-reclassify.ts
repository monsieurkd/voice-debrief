// Verify reclassify (move a row between tables) on a throwaway session, then clean up.
// Checks: old row gone, new row has the same text + source='user'/was_corrected=true,
// tag_links rewritten to the new entity, no stray links left on the old entity.
// Asserts (exits non-zero on any failure). Needs a migrated local Postgres.
import assert from 'node:assert/strict'
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
  assert.ok(ev, 'source event stored')
  const before = await db.select().from(tagLinks).where(and(eq(tagLinks.entity_type, 'event'), eq(tagLinks.entity_id, ev.id)))
  assert.equal(before.length, 1, 'event has its tag link')

  const newId = await reclassifyRowEntity('event', ev.id, 'reflection')
  assert.notEqual(newId, ev.id, 'reclassify returns a NEW row id')

  const evGone = await db.select().from(events).where(eq(events.id, ev.id))
  assert.equal(evGone.length, 0, 'old event row is gone')

  const [ref] = await db.select().from(reflections).where(eq(reflections.id, newId))
  assert.ok(ref, 'new reflection row exists')
  assert.equal(ref.content, 'A tagged event to move', 'text survived the move')
  assert.equal(ref.source, 'user', 'moved row is source=user')
  assert.equal(ref.was_corrected, true, 'moved row is was_corrected=true')

  const after = await db.select().from(tagLinks).where(and(eq(tagLinks.entity_type, 'reflection'), eq(tagLinks.entity_id, newId)))
  const stray = await db.select().from(tagLinks).where(and(eq(tagLinks.entity_type, 'event'), eq(tagLinks.entity_id, ev.id)))
  assert.equal(after.length, before.length, 'tag_links rewritten to the new entity')
  assert.equal(stray.length, 0, 'no stray tag_links on the old entity')

  // cleanup the throwaway session. user_state.last_session_id references it via a
  // NO-ACTION FK, so clear that first, then delete (cascade removes rows + tag_links).
  await db.update(userState).set({ last_session_id: null }).where(eq(userState.user_id, 1))
  await db.delete(sessions).where(eq(sessions.id, sid))

  console.log('✅ reclassify verified: moved, tags rewritten, no strays, throwaway session cleaned')
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ reclassify test failed:', e)
  process.exit(1)
})
