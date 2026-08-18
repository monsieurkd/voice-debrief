// Ported from scripts/extract-selftest.ts (the only previously-asserting test)
// to node:test so `npm test` runs it in CI. Deterministic — no key or network:
// the retry loop runs against an injected scripted completer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractDebrief, ExtractionError } from '../src/lib/extract'
import { safeJsonParse } from '../src/lib/json'
import { extractionPayload } from '../src/lib/extraction-schema'

test('safeJsonParse strips ```json fences and parses', () => {
  const fenced = safeJsonParse('```json\n{"overview":"hi","events":[]}\n```') as { overview: string }
  assert.equal(fenced.overview, 'hi')
})

test('extraction schema accepts a well-formed payload', () => {
  const good = extractionPayload.safeParse({
    overview: 'Good day.',
    events: [{ what: 'Met Sarah', tags: [] }],
    reflections: [],
    decisions: [{ summary: 'Ship Friday', resolved: true }],
    next_steps: [],
  })
  assert.ok(good.success)
})

test('extraction schema rejects an empty overview', () => {
  const bad = extractionPayload.safeParse({ overview: '', events: [] })
  assert.ok(!bad.success)
})

test('retry loop recovers the valid payload after two bad attempts', async () => {
  const validJson = JSON.stringify({
    overview: 'Rough day.',
    mood: 'low',
    energy: 2,
    events: [{ what: 'Standup went sideways', tags: [{ kind: 'person', name: 'Sarah' }] }],
    reflections: [{ content: 'Not sure the deadline is realistic', kind: 'worry' }],
    decisions: [{ summary: 'Push the deadline to next week', rationale: 'not realistic', resolved: true }],
    next_steps: [{ content: 'Scope the deadline down with Sarah', status: 'open', goal: 'Launch' }],
  })
  let step = 0
  const calls: string[] = []
  const scripted = async (): Promise<string> => {
    calls.push('call')
    step++
    if (step === 1) return 'not json at all'
    if (step === 2) return '{ "overview": "ok", "events": [], "reflections": [ { "kind": "worry" } ] }' // reflection missing content
    return validJson
  }
  const out = await extractDebrief('dummy transcript', { complete: scripted })
  assert.equal(out.overview, 'Rough day.')
  assert.equal(calls.length, 3) // initial + 2 retries
  assert.equal(out.next_steps[0].goal, 'Launch') // goal carried as a title string, not an id
})

test('always-bad output throws ExtractionError after exhausting retries', async () => {
  await assert.rejects(
    extractDebrief('x', { complete: async () => 'garbage every time' }),
    ExtractionError,
  )
})
