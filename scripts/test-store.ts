// Verify storeSession end-to-end against the DB with a hand-crafted payload.
// No API key needed — this tests the transactional store, not extraction.
// Asserts (exits non-zero on any failure). Needs a migrated local Postgres.
import assert from 'node:assert/strict'
import { storeSession } from '../src/lib/store'
import { db } from '../src/db/client'
import { sessions, events, reflections, decisions, nextSteps, goals, userState, tagLinks } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import type { ExtractionPayload } from '../src/lib/extraction-schema'

const payload: ExtractionPayload = {
  overview: 'Rough day — clashed with Sarah over the launch deadline.',
  mood: 'low',
  energy: 2,
  pace: 'rushed',
  engagement: 3,
  tone: 'frustrated',
  events: [
    {
      what: 'Standup went sideways; clashed with Sarah over the deadline',
      tags: [{ kind: 'person', name: 'Sarah' }, { kind: 'project', name: 'Launch' }],
    },
  ],
  reflections: [{ content: 'Not sure the new deadline is realistic', kind: 'worry', tags: [{ kind: 'project', name: 'Launch' }] }],
  decisions: [{ summary: 'Push the launch deadline to next week', rationale: 'not sure it is realistic', resolved: true, tags: [] }],
  next_steps: [{ content: 'Scope the deadline down with Sarah', status: 'open', goal: 'Launch', tags: [{ kind: 'person', name: 'Sarah' }] }],
}

async function main() {
  const sessionId = await storeSession('Dummy transcript for the store test.', payload)

  const [s] = await db.select().from(sessions).where(eq(sessions.id, sessionId))
  assert.ok(s, 'session row exists')
  assert.equal(s.overview, payload.overview)
  assert.equal(s.mood, 'low')
  assert.equal(s.tone, 'frustrated')
  assert.equal(s.transcript, 'Dummy transcript for the store test.')

  const [evs, refs, decs, steps] = await Promise.all([
    db.select().from(events).where(eq(events.session_id, sessionId)),
    db.select().from(reflections).where(eq(reflections.session_id, sessionId)),
    db.select().from(decisions).where(eq(decisions.session_id, sessionId)),
    db.select().from(nextSteps).where(eq(nextSteps.session_id, sessionId)),
  ])
  assert.equal(evs.length, 1, 'one event stored')
  assert.equal(refs.length, 1, 'one reflection stored')
  assert.equal(decs.length, 1, 'one decision stored')
  assert.equal(steps.length, 1, 'one next_step stored')

  assert.equal(evs[0].source, 'ai', 'extracted rows are source=ai')
  assert.equal(evs[0].was_corrected, false)
  assert.equal(decs[0].resolved, true)
  assert.equal(decs[0].rationale, 'not sure it is realistic')
  assert.equal(steps[0].status, 'open')

  // tags + polymorphic links landed for every kind of child row
  const links = await db.select().from(tagLinks)
  const byType = (t: string) => links.filter((l) => l.entity_type === t).length
  assert.ok(byType('event') >= 2, 'event tag_links stored (person+project)')
  assert.ok(byType('reflection') >= 1, 'reflection tag_links stored')
  assert.ok(byType('next_step') >= 1, 'next_step tag_links stored')

  // goal resolved by TITLE (created, not an id passthrough)
  const allGoals = await db.select().from(goals).where(eq(goals.user_id, 1))
  assert.ok(allGoals.some((g) => g.title === 'Launch'), "goal 'Launch' resolved/created by title")
  assert.ok(steps[0].goal_id != null, 'next_step wired to goal_id')

  // user_state adapted for the next session
  const [us] = await db.select().from(userState).where(eq(userState.user_id, 1))
  assert.ok(us, 'user_state row exists')
  assert.ok((us.sessions_count ?? 0) >= 1, 'sessions_count incremented')
  assert.equal(us.last_session_id, sessionId, 'last_session_id points at the new session')
  assert.equal(us.last_mood, 'low')

  console.log(`✅ store verified — session ${sessionId}: 4 children, tags+links, goal, user_state`)
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ store test failed:', e)
  process.exit(1)
})
