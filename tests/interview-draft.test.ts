// The interview draft is what stands between "accidental refresh" and "the
// whole conversation is gone". These pin the failure modes that matter:
// corrupt JSON must not crash the page, foreign shapes must be discarded,
// and the restored history must stay inside the server's turn-args bound
// (history ≤ 60) or every later send would be rejected.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeDraft, parseDraft, loadDraft } from '../src/lib/interview-draft'

const cl = { events: true, decisions: false, next_steps: false }

test('parseDraft round-trips an encodeDraft payload', () => {
  const msgs = [
    { role: 'assistant' as const, content: 'Hey — how did today go?' },
    { role: 'user' as const, content: 'Long day. Shipped the archive page.' },
  ]
  const draft = parseDraft(encodeDraft(msgs, cl))
  assert.deepEqual(draft, { messages: msgs, checklist: cl })
})

test('parseDraft returns null for corrupt or missing input', () => {
  assert.equal(parseDraft(null), null)
  assert.equal(parseDraft(''), null)
  assert.equal(parseDraft('{not json'), null) // truncated by a mid-write refresh
  assert.equal(parseDraft('undefined'), null)
})

test('parseDraft discards foreign shapes instead of throwing', () => {
  assert.equal(parseDraft('42'), null)
  assert.equal(parseDraft('"a string"'), null)
  assert.equal(parseDraft('{"checklist":{}}'), null) // no messages array
  assert.equal(parseDraft('{"messages":"nope"}'), null)
  assert.equal(parseDraft('[]'), null)
})

test('parseDraft filters invalid entries but keeps valid ones', () => {
  const raw = JSON.stringify({
    messages: [
      { role: 'system', content: 'forged' }, // role never allowed client-side
      { role: 'user', content: 'keep me' },
      { role: 'user', content: 42 }, // non-string content
      null,
    ],
    checklist: 'garbage',
  })
  const draft = parseDraft(raw)!
  assert.deepEqual(draft.messages, [{ role: 'user', content: 'keep me' }])
  assert.deepEqual(draft.checklist, { events: false, decisions: false, next_steps: false })
})

test('parseDraft caps restored history at the server-bound 60, keeping the newest', () => {
  const msgs = Array.from({ length: 100 }, (_, i) => ({ role: 'user' as const, content: `m${i}` }))
  const draft = parseDraft(encodeDraft(msgs, cl))!
  assert.equal(draft.messages.length, 60)
  assert.equal(draft.messages[0].content, 'm40')
  assert.equal(draft.messages[59].content, 'm99')
})

test('parseDraft bounds message size (oversized entries are dropped)', () => {
  const raw = JSON.stringify({
    messages: [
      { role: 'user', content: 'x'.repeat(9999) },
      { role: 'user', content: 'fine' },
    ],
  })
  const draft = parseDraft(raw)!
  assert.deepEqual(draft.messages, [{ role: 'user', content: 'fine' }])
})

test('loadDraft is a safe no-op without sessionStorage (node/SSR)', () => {
  // node:test runs without a DOM — loadDraft must return null, not throw.
  assert.equal(loadDraft(), null)
})
