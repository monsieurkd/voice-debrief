// Verify the threads store/list/replace cycle against the DB: store on a
// throwaway session, list them back, then replace (latest snapshot wins) and
// confirm the old batch is gone. Cleanup: deleting the session cascades.
import assert from 'node:assert/strict'
import { storeSession } from '../src/lib/store'
import { storeThreads, listThreads } from '../src/lib/threads'
import { db } from '../src/db/client'
import { insights, sessions, userState } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import type { ExtractionPayload } from '../src/lib/extraction-schema'

const payload: ExtractionPayload = {
  overview: 'Threads test session.',
  events: [{ what: 'An event', tags: [] }],
  reflections: [],
  decisions: [],
  next_steps: [],
}

async function main() {
  const sid = await storeSession('threads test transcript', payload)

  const batch1 = [
    { title: 'First thread', detail: 'detail one', kind: 'pattern' as const, dates: ['Mon 17'] },
    { title: 'Second thread', detail: 'detail two', kind: 'progress' as const, dates: ['Mon 17', 'Tue 18'] },
  ]
  await storeThreads(1, sid, batch1)
  let listed = await listThreads(1)
  assert.equal(listed.length, 2, 'both threads stored')
  assert.ok(listed.some((t) => t.title === 'First thread' && t.kind === 'pattern'))
  assert.ok(listed.some((t) => t.dates.length === 2), 'dates round-trip through related jsonb')

  // replace: latest snapshot wins — panel shows current threads, not history
  const batch2 = [{ title: 'Replaced thread', detail: 'newer detail', kind: 'nudge' as const, dates: ['Tue 18'] }]
  await storeThreads(1, sid, batch2)
  listed = await listThreads(1)
  assert.equal(listed.length, 1, 'second store replaced the first batch')
  assert.equal(listed[0]!.title, 'Replaced thread')

  // cleanup: user_state.last_session_id references this session via a NO-ACTION
  // FK (Phase 1 migrates it to SET NULL) — clear it, then delete (cascades insights)
  await db.update(userState).set({ last_session_id: null }).where(eq(userState.user_id, 1))
  await db.delete(sessions).where(eq(sessions.id, sid))
  const left = await db.select().from(insights).where(eq(insights.source_session_id, sid))
  assert.equal(left.length, 0, 'insights cascade-deleted with the session')

  console.log('✅ threads verified: store, list, replace, cascade cleanup')
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ threads test failed:', e)
  process.exit(1)
})
