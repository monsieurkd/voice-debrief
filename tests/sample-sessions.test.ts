// Demo mode's pre-baked payloads must stay valid: if the extraction schema
// drifts, these break the demo silently at showtime instead of loudly in CI.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSampleSessions } from '../src/lib/sample-sessions'
import { sampleTranscripts } from '../src/lib/sample-transcripts'
import { extractionPayload } from '../src/lib/extraction-schema'
import { parseDateOnly } from '../src/lib/dates'

test('every pre-baked sample validates against the real extraction schema', () => {
  const samples = buildSampleSessions(new Date('2026-08-18T04:00:00Z'))
  assert.equal(samples.length, sampleTranscripts.length, 'one payload per sample transcript')
  for (const s of samples) {
    const res = extractionPayload.safeParse(s.payload)
    assert.ok(res.success, `sample ${s.id} (${s.label}) still validates: ${res.success ? '' : JSON.stringify(res.error.issues)}`)
    assert.equal(s.transcript, sampleTranscripts[s.id].text, 'sample paired with its real transcript')
  }
})

test('sample due dates parse as real dates near today (stay inside the plan window)', () => {
  const now = new Date('2026-08-18T04:00:00Z')
  const samples = buildSampleSessions(now)
  const dues = samples.flatMap((s) => s.payload.next_steps.map((n) => n.due_on))
  assert.ok(dues.length >= 4, 'samples carry next_steps with due dates')
  for (const d of dues) {
    const parsed = parseDateOnly(d, { now })
    assert.ok(parsed, `due_on '${d}' parses`)
    assert.match(parsed!, /^2026-08-(18|19|20)$/, 'due lands today..+2 days')
  }
})
