// Threads = the cross-day pass that makes the compounding visible. These pin
// the schema, the baked demo-week threads (keyless payoff), and the prompt.
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.APP_TIMEZONE = 'Asia/Ho_Chi_Minh'

import { threadSchema, generateThreads, buildThreadsUserPrompt, type ThreadSessionInput } from '../src/lib/threads'
import { bakedDemoWeekThreads, buildDemoWeek } from '../src/lib/demo-week'

const NOW = new Date('2026-08-18T04:00:00Z')

test('baked demo-week threads validate against the thread schema', () => {
  const threads = bakedDemoWeekThreads(NOW)
  assert.equal(threads.length, 3)
  for (const t of threads) {
    const res = threadSchema.safeParse(t)
    assert.ok(res.success, `${t.title} validates: ${res.success ? '' : JSON.stringify(res.error.issues)}`)
  }
})

test('baked threads carry the three kinds and are grounded in dates', () => {
  const threads = bakedDemoWeekThreads(NOW)
  const kinds = new Set(threads.map((t) => t.kind))
  assert.ok(kinds.has('pattern') && kinds.has('progress') && kinds.has('nudge'))
  for (const t of threads) {
    assert.ok(t.dates.length >= 2, `${t.title} spans multiple days`)
    for (const d of t.dates) assert.match(d, /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}$/, `date label '${d}'`)
  }
})

test('baked thread dates reference real seeded days', () => {
  const week = buildDemoWeek(NOW)
  const seededDays = new Set(week.map((d) => d.startedAt.toISOString().slice(0, 10)))
  const threads = bakedDemoWeekThreads(NOW)
  // labels derive from buildDemoWeek itself — spot-check one maps to a seeded day
  const label = threads[0]!.dates[0]!
  const dayNum = Number(label.split(' ')[1])
  assert.ok([...seededDays].some((iso) => Number(iso.slice(8, 10)) === dayNum), 'label day exists in the seeded week')
})

test('buildThreadsUserPrompt serializes sessions oldest-first with their rows', () => {
  const a: ThreadSessionInput = {
    id: 1,
    startedAt: new Date('2026-08-16T12:00:00Z'),
    overview: 'Day one overview',
    events: ['Standup clash'],
    decisions: ['OPEN: push deadline'],
    nextSteps: ['scope down with Sarah'],
  }
  const b: ThreadSessionInput = {
    id: 2,
    startedAt: new Date('2026-08-17T12:00:00Z'),
    overview: 'Day two overview',
    events: [],
    decisions: ['cut the migration tool'],
    nextSteps: [],
  }
  const prompt = buildThreadsUserPrompt([a, b])
  assert.ok(prompt.indexOf('Day one overview') < prompt.indexOf('Day two overview'), 'oldest first')
  assert.ok(prompt.includes('- event: Standup clash'))
  assert.ok(prompt.includes('- decision: OPEN: push deadline'), 'unresolved decisions are flagged')
  assert.ok(prompt.includes('- next: scope down with Sarah'))
  assert.ok(prompt.includes('[Mon 17] Day two overview'), 'dates labelled in the model format') // 2026-08-17 is a Monday
})

test('generateThreads retries through a bad completion and validates', async () => {
  const good = JSON.stringify({
    threads: [
      { title: 'The launch unblocked', detail: 'Scope-down with Sarah moved it from clash to merged doc.', kind: 'progress', dates: ['Thu 13', 'Fri 14'] },
    ],
  })
  let calls = 0
  const threads = await generateThreads([makeSession()], {
    complete: async () => {
      calls++
      return calls === 1 ? 'not json' : good
    },
  })
  assert.equal(threads.length, 1)
  assert.equal(threads[0]!.kind, 'progress')
  assert.equal(calls, 2)
})

function makeSession(): ThreadSessionInput {
  return {
    id: 1,
    startedAt: new Date('2026-08-17T12:00:00Z'),
    overview: 'overview',
    events: ['e'],
    decisions: ['d'],
    nextSteps: ['n'],
  }
}
