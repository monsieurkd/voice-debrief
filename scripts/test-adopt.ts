// Verify deferred attribution end-to-end: a guest debriefs (stored under an
// anonymous users row), then adopts onto a real account — the session, its
// rows, goals, tags/tag_links and user_state all re-parent to the real user,
// the guest user row is deleted, and nothing is left behind.
// Asserts (exits non-zero on any failure). Needs a migrated local Postgres.
import assert from 'node:assert/strict'
import { storeSession } from '../src/lib/store'
import { loadSession } from '../src/lib/session'
import { db } from '../src/db/client'
import { users, sessions, goals, tags, tagLinks, userState, nextSteps } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../src/lib/passwd'
import { adoptGuestData } from '../src/lib/adopt'
import type { ExtractionPayload } from '../src/lib/extraction-schema'

const payload: ExtractionPayload = {
  overview: 'A guest day, later adopted.',
  mood: 'neutral',
  next_steps: [
    { content: 'Adopt-me step', status: 'open', goal: 'Guest goal', tags: [{ kind: 'project', name: 'launch' }] },
  ],
  events: [{ what: 'Guest event', tags: [{ kind: 'person', name: 'sarah' }] }],
  reflections: [],
  decisions: [],
}

async function main() {
  // One anonymous guest + one real account.
  const [guest] = await db.insert(users).values({ email: null, password_hash: null }).returning({ id: users.id })
  const G = guest!.id
  const [owner] = await db
    .insert(users)
    .values({ email: `adopt-test-${Date.now()}@example.test`, password_hash: await hashPassword('test-password-123') })
    .returning({ id: users.id })
  const R = owner!.id
  try {
    const sId = await storeSession('guest transcript', payload, { userId: G })

    // Precondition: the guest owns the session + a unique goal + tags.
    assert.equal((await db.select().from(sessions).where(eq(sessions.user_id, G))).length, 1, 'guest owns the session')
    const [gGoal] = await db.select().from(goals).where(eq(goals.user_id, G))
    assert.ok(gGoal, 'guest owns a goal')
    const gTags = await db.select().from(tags).where(eq(tags.user_id, G))
    assert.equal(gTags.length, 2, 'guest owns both tags')

    // Adopt: everything re-parents to R, the guest user row is removed.
    await adoptGuestData(G, R)

    assert.equal((await db.select().from(sessions).where(eq(sessions.user_id, G))).length, 0, 'no sessions remain on guest')
    assert.ok(await loadSession(sId, R), 'real user now owns the session')
    assert.equal((await db.select().from(sessions).where(eq(sessions.user_id, R))).length, 1, 'real user sees 1 session')
    assert.equal((await db.select().from(goals).where(eq(goals.user_id, G))).length, 0, 'no goals remain on guest')
    assert.equal((await db.select().from(tags).where(eq(tags.user_id, G))).length, 0, 'no tags remain on guest')

    // tag_links followed the tags to the real user (each tag referenced once).
    const rTags = await db.select().from(tags).where(eq(tags.user_id, R))
    assert.equal(rTags.length, 2, 'real user now owns both tags')
    const links = await db
      .select()
      .from(tagLinks)
      .where(eq(tagLinks.tag_id, rTags[0].id))
    assert.ok(links.length >= 1, 'tag_link repointed onto the adopted tag')

    // user_state merged onto R (count reflects the adopted session).
    const [us] = await db.select().from(userState).where(eq(userState.user_id, R))
    assert.equal(us.sessions_count, 1, 'user_state count includes the adopted session')

    // guest row actually deleted.
    assert.equal((await db.select().from(users).where(eq(users.id, G))).length, 0, 'anonymous guest row removed')

    // Cleanup: the adopted session + dependencies ride the owner's delete.
    await db.delete(sessions).where(eq(sessions.user_id, R))
    assert.equal((await db.select().from(nextSteps).where(eq(nextSteps.session_id, sId))).length, 0, 'child rows cascade with session')
  } finally {
    await db.delete(users).where(eq(users.id, R))
    await db.delete(users).where(eq(users.id, G)).catch(() => {}) // already gone if adoption ran
  }

  console.log('✅ adoption verified: guest session + rows + tags + state re-parent to the real user; guest row cleaned up')
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ adoption test failed:', e)
  process.exit(1)
})
