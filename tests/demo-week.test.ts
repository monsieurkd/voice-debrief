// Demo week must stay valid and stay a *story*: dates ordered, threads
// weaving across days, open steps landing inside the plan window.
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.APP_TIMEZONE = 'Asia/Ho_Chi_Minh'

import { buildDemoWeek } from '../src/lib/demo-week'
import { extractionPayload } from '../src/lib/extraction-schema'
import { parseDateOnly, todayInAppTz, isoMinusDays } from '../src/lib/dates'

const NOW = new Date('2026-08-18T04:00:00Z')
const week = buildDemoWeek(NOW)

test('five days, oldest first, every payload validates', () => {
  assert.equal(week.length, 5)
  for (const day of week) {
    const res = extractionPayload.safeParse(day.payload)
    assert.ok(res.success, `day offset ${day.dayOffset} validates`)
    assert.ok(day.transcript.length > 100, `day offset ${day.dayOffset} has a real transcript`)
  }
})

test('days are backdated and strictly ordered', () => {
  const times = week.map((d) => d.startedAt.getTime())
  assert.deepEqual(week.map((d) => d.dayOffset), [4, 3, 2, 1, 0])
  for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1], 'each day after the previous')
  // oldest day is ~4 days before today (anchored 19:40 app-TZ)
  const oldest = times[0]
  const expectedOldest = Date.parse(`${isoMinusDays(todayInAppTz(NOW), 4)}T19:40:00.000+07:00`)
  assert.equal(oldest, expectedOldest)
})

test('threads weave across days (the compounding is real data)', () => {
  const texts = week.map((d) =>
    [
      d.transcript,
      ...d.payload.events.map((e) => e.what),
      ...d.payload.decisions.map((x) => x.summary),
      ...d.payload.next_steps.map((s) => s.content),
    ].join(' '),
  )
  const launchDays = texts.filter((t) => /launch/i.test(t)).length
  const sarahDays = texts.filter((t) => /sarah/i.test(t)).length
  const priyaDays = texts.filter((t) => /priya|migration/i.test(t)).length
  assert.ok(launchDays >= 4, `Launch thread spans the week (${launchDays} days)`)
  assert.ok(sarahDays >= 3, `Sarah thread spans days (${sarahDays} days)`)
  assert.ok(priyaDays >= 2, `Migration thread spans days (${priyaDays} days)`)
})

test('open next_steps land inside the plan window (last 7 days by due date)', () => {
  const open = week.flatMap((d) => d.payload.next_steps.filter((s) => s.status === 'open'))
  assert.ok(open.length >= 3, 'a few open steps for the plan panel')
  for (const s of open) {
    const due = parseDateOnly(s.due_on, { now: NOW })
    assert.ok(due, `due_on '${s.due_on}' parses`)
    assert.ok(due >= isoMinusDays(todayInAppTz(NOW), 7), `due ${due} not stale`)
  }
})

test('some steps are done — the week shows progress, not a backlog', () => {
  const all = week.flatMap((d) => d.payload.next_steps)
  assert.ok(all.some((s) => s.status === 'done'), 'at least one done step')
})
