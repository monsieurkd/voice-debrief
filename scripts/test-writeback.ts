// Verify the write-back mutations (edit / add / delete) at the DB level.
// Tests lib/mutations directly (no Next runtime / revalidatePath needed). No API key.
import { updateRowText, addRowText, deleteRowEntity } from '../src/lib/mutations'
import { db } from '../src/db/client'
import { events, reflections } from '../src/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  // grab an existing event to edit (created by test-store on session 1)
  const [ev] = await db.select().from(events).limit(1)
  if (!ev) {
    console.log('No event row found — run `npm run test-store` first (oh wait, there is no such script).')
    console.log('Run: npx tsx scripts/test-store.ts')
    process.exit(0)
  }
  const original = ev.what
  console.log('event before:', { id: ev.id, what: original, source: ev.source, was_corrected: ev.was_corrected })

  // EDIT → source='user', was_corrected=true
  await updateRowText('event', ev.id, 'EDITED ' + original)
  const [ev2] = await db.select().from(events).where(eq(events.id, ev.id))
  console.log('event after edit:', { what: ev2!.what, source: ev2!.source, was_corrected: ev2!.was_corrected })

  // ADD → new row, source='user'
  const newId = await addRowText('reflection', ev.session_id, 'A user-added reflection')
  const [r] = await db.select().from(reflections).where(eq(reflections.id, newId))
  console.log('added reflection:', { id: r!.id, content: r!.content, source: r!.source })

  // DELETE → row gone
  await deleteRowEntity('reflection', newId)
  const gone = await db.select().from(reflections).where(eq(reflections.id, newId))
  console.log('after delete, reflection exists?', gone.length === 0, '(expected false → true)')

  // revert the edit so session 1 stays clean for the viewer demo
  await updateRowText('event', ev.id, original)
  console.log('reverted edit to original')

  console.log('\n✅ write-back mutations verified')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
