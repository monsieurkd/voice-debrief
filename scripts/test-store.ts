// Verify storeSession end-to-end against the DB with a hand-crafted payload.
// No API key needed — this tests the transactional store, not extraction.
import { storeSession } from '../src/lib/store'
import { db } from '../src/db/client'
import { sessions, events, reflections, decisions, nextSteps, goals, userState } from '../src/db/schema'
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
  console.log('stored session id:', sessionId)

  const [s] = await db.select().from(sessions).where(eq(sessions.id, sessionId))
  console.log('session:', { id: s?.id, overview: s?.overview, mood: s?.mood, tone: s?.tone })

  const [evs, refs, decs, steps] = await Promise.all([
    db.select().from(events).where(eq(events.session_id, sessionId)),
    db.select().from(reflections).where(eq(reflections.session_id, sessionId)),
    db.select().from(decisions).where(eq(decisions.session_id, sessionId)),
    db.select().from(nextSteps).where(eq(nextSteps.session_id, sessionId)),
  ])
  console.log('child rows:', { events: evs.length, reflections: refs.length, decisions: decs.length, next_steps: steps.length })
  console.log('event quality flags:', evs[0] && { source: evs[0].source, was_corrected: evs[0].was_corrected })
  console.log('decision:', decs[0] && { summary: decs[0].summary, resolved: decs[0].resolved, rationale: decs[0].rationale })
  console.log('next_step goal_id:', steps[0]?.goal_id, '| status:', steps[0]?.status)

  const [us] = await db.select().from(userState).where(eq(userState.user_id, 1))
  console.log('user_state:', { sessions_count: us?.sessions_count, last_session_id: us?.last_session_id, last_mood: us?.last_mood })

  const allGoals = await db.select().from(goals).where(eq(goals.user_id, 1))
  console.log('goals:', allGoals.map((g) => g.title))

  console.log('\n✅ store verified — open /session/' + sessionId + ' once the viewer exists')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
