// Verify the write-back mutations (edit / add / delete) at the DB level.
// Tests lib/mutations directly (no Next runtime / revalidatePath needed). No API key.
// Asserts (exits non-zero on any failure). Run after test-store (needs any event row).
import assert from 'node:assert/strict'
import { updateRowText, addRowText, deleteRowEntity } from '../src/lib/mutations'
import { db } from '../src/db/client'
import { events, reflections } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import { USER_ID } from '../src/lib/constants'

async function main() {
  const [ev] = await db.select().from(events).limit(1)
  if (!ev) {
    console.error('No event row found — run `npm run test:db` (test-store runs first).')
    process.exit(1)
  }
  const original = ev.what

  // EDIT → source='user', was_corrected=true (the data-quality loop)
  await updateRowText('event', ev.id, 'EDITED ' + original, USER_ID)
  const [ev2] = await db.select().from(events).where(eq(events.id, ev.id))
  assert.equal(ev2.what, 'EDITED ' + original, 'edit persisted')
  assert.equal(ev2.source, 'user', 'edit marks source=user')
  assert.equal(ev2.was_corrected, true, 'edit marks was_corrected=true')

  // ADD → new row, source='user'
  const newId = await addRowText('reflection', ev.session_id, 'A user-added reflection', USER_ID)
  const [r] = await db.select().from(reflections).where(eq(reflections.id, newId))
  assert.ok(r, 'added reflection exists')
  assert.equal(r.content, 'A user-added reflection')
  assert.equal(r.source, 'user')

  // DELETE → row gone
  await deleteRowEntity('reflection', newId, USER_ID)
  const gone = await db.select().from(reflections).where(eq(reflections.id, newId))
  assert.equal(gone.length, 0, 'deleted reflection is gone')

  // revert the edit so the demo session stays clean
  await updateRowText('event', ev.id, original, USER_ID)

  console.log('✅ write-back verified: edit→source=user/corrected, add, delete')
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ writeback test failed:', e)
  process.exit(1)
})
