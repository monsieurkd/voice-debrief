// Verify multi-user isolation at the data layer: create a throwaway user B with
// a real session, then assert user A (the seeded user) can neither SEE nor
// MUTATE B's rows — reads return nothing, writes throw RowOwnershipError and
// leave the data untouched. Also pins the goals(user_id, lower(title))
// conflict path: storing the same goal title twice yields ONE goal row.
// Asserts (exits non-zero on any failure). Needs a migrated local Postgres.
import assert from 'node:assert/strict'
import { storeSession } from '../src/lib/store'
import { loadSession } from '../src/lib/session'
import { listSessions, listOpenNextSteps } from '../src/lib/queries'
import { updateRowText, addRowText, deleteRowEntity, setNextStepStatus, RowOwnershipError } from '../src/lib/mutations'
import { reclassifyRowEntity } from '../src/lib/reclassify'
import { db } from '../src/db/client'
import { users, sessions, events, nextSteps, goals } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../src/lib/passwd'
import { USER_ID } from '../src/lib/constants'
import type { ExtractionPayload } from '../src/lib/extraction-schema'

const payload: ExtractionPayload = {
  overview: 'Tenant B had a fine day.',
  mood: 'high',
  next_steps: [
    { content: 'B-private step that A must never see', status: 'open', goal: 'B-private goal', tags: [] },
  ],
  events: [{ what: 'B-private event that A must never edit', tags: [] }],
  reflections: [],
  decisions: [],
}

async function expectOwnershipError(fn: () => Promise<unknown>, label: string) {
  try {
    await fn()
  } catch (e) {
    assert.ok(e instanceof RowOwnershipError, `${label}: threw RowOwnershipError (got ${e?.constructor?.name})`)
    return
  }
  assert.fail(`${label}: expected RowOwnershipError, got success`)
}

async function main() {
  // throwaway user B (identity columns — never insert an explicit id)
  const [b] = await db
    .insert(users)
    .values({ email: `tenancy-test-${Date.now()}@example.test`, password_hash: await hashPassword('test-password-123') })
    .returning({ id: users.id })
  const B = b!.id
  const A = USER_ID
  try {
    const bSession = await storeSession('tenant B transcript', payload, { userId: B })
    const [bEvent] = await db.select().from(events).where(eq(events.session_id, bSession))
    const [bStep] = await db.select().from(nextSteps).where(eq(nextSteps.session_id, bSession))

    // ── READS: A must not see B's data, B must see their own ──
    assert.equal(await loadSession(bSession, A), null, 'loadSession: A gets null for B session (not 403-worthy data)')
    const bView = await loadSession(bSession, B)
    assert.ok(bView, 'loadSession: B sees their own session')
    assert.ok(bView.blocks.some((x) => x.text.includes('B-private')), 'B view contains B rows')

    assert.ok(!(await listSessions(A)).some((s) => s.id === bSession), 'listSessions(A) excludes B session')
    assert.ok((await listSessions(B)).some((s) => s.id === bSession), 'listSessions(B) includes B session')

    assert.ok(!(await listOpenNextSteps(A)).some((p) => p.id === bStep.id), 'plan(A) excludes B step')
    assert.ok((await listOpenNextSteps(B)).some((p) => p.id === bStep.id), 'plan(B) includes B step')

    // ── MUTATIONS: A acting on B ids must throw and change nothing ──
    await expectOwnershipError(() => updateRowText('event', bEvent.id, 'hijacked', A), 'updateRowText')
    await expectOwnershipError(() => addRowText('reflection', bSession, 'hijacked', A), 'addRowText')
    await expectOwnershipError(() => deleteRowEntity('event', bEvent.id, A), 'deleteRowEntity')
    await expectOwnershipError(() => reclassifyRowEntity('event', bEvent.id, 'reflection', A), 'reclassifyRowEntity')
    await expectOwnershipError(() => setNextStepStatus(bStep.id, 'done', A), 'setNextStepStatus')
    await expectOwnershipError(() => reclassifyRowEntity('event', bEvent.id, 'event', A), 'reclassify no-op')

    const [stillThere] = await db.select().from(events).where(eq(events.id, bEvent.id))
    assert.equal(stillThere.what, payload.events[0].what, "B's event text unchanged after A's attempt")
    const [stillOpen] = await db.select().from(nextSteps).where(eq(nextSteps.id, bStep.id))
    assert.equal(stillOpen.status, 'open', "B's step status unchanged after A's attempt")

    // B's own mutations still work
    await setNextStepStatus(bStep.id, 'done', B)
    const [nowDone] = await db.select().from(nextSteps).where(eq(nextSteps.id, bStep.id))
    assert.equal(nowDone.status, 'done', 'B can mutate their own step')

    // ── goals: same title stored twice for B → exactly one row (conflict path) ──
    await storeSession('tenant B transcript 2', { ...payload, events: [], next_steps: [{ content: 'again', status: 'open', goal: 'B-private goal', tags: [] }] }, { userId: B })
    const bGoals = await db.select().from(goals).where(eq(goals.user_id, B))
    assert.equal(bGoals.filter((g) => g.title === 'B-private goal').length, 1, 'goal dedup via unique(lower(title)) conflict')
  } finally {
    // cascade removes B's sessions/rows/goals/tags/user_state
    await db.delete(users).where(eq(users.id, B))
    // paranoia: nothing of B's survived
    assert.equal((await db.select().from(sessions).where(eq(sessions.user_id, B))).length, 0, 'B sessions gone after user delete')
  }

  console.log('✅ tenancy verified: reads scoped, cross-user writes rejected, goal conflict path, cascade cleanup')
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ tenancy test failed:', e)
  process.exit(1)
})
