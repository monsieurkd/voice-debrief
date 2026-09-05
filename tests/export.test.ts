// Export payload builder: shape (app/version), ISO dates, chronological
// message order, messageCount, and persona label resolution. Pure — no DB.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildExportPayload } from '../src/lib/export'

const exportedAt = new Date('2026-09-01T12:00:00.000Z')

const conv = {
  id: 7,
  title: 'Long day at work',
  persona: 'coach',
  createdAt: new Date('2026-08-31T09:30:00.000Z'),
}

const msgs = [
  { role: 'user' as const, content: 'first', createdAt: new Date('2026-08-31T09:30:05.000Z') },
  { role: 'assistant' as const, content: 'second', createdAt: new Date('2026-08-31T09:30:09.000Z') },
]

test('payload carries app/version keys and ISO-8601 exportedAt', () => {
  const p = buildExportPayload(conv, msgs, exportedAt)
  assert.equal(p.app, 'what-i-mean')
  assert.equal(p.version, 1)
  assert.equal(p.exportedAt, '2026-09-01T12:00:00.000Z')
})

test('conversation metadata: id/title pass through, createdAt becomes ISO', () => {
  const p = buildExportPayload(conv, msgs, exportedAt)
  assert.equal(p.conversation.id, 7)
  assert.equal(p.conversation.title, 'Long day at work')
  assert.equal(p.conversation.createdAt, '2026-08-31T09:30:00.000Z')
  // ISO strings must round-trip through Date unchanged.
  assert.equal(new Date(p.conversation.createdAt).toISOString(), p.conversation.createdAt)
})

test('messages are exported chronologically even when handed in reverse', () => {
  const p = buildExportPayload(conv, [msgs[1]!, msgs[0]!], exportedAt)
  assert.deepEqual(
    p.conversation.messages.map((m) => m.content),
    ['first', 'second'],
  )
})

test('messageCount matches the exported messages', () => {
  assert.equal(buildExportPayload(conv, msgs, exportedAt).conversation.messageCount, 2)
  assert.equal(buildExportPayload(conv, [], exportedAt).conversation.messageCount, 0)
  assert.deepEqual(buildExportPayload(conv, [], exportedAt).conversation.messages, [])
})

test('each message keeps its role/content and emits an ISO createdAt', () => {
  const p = buildExportPayload(conv, msgs, exportedAt)
  const [a, b] = p.conversation.messages
  assert.deepEqual(a, { role: 'user', content: 'first', createdAt: '2026-08-31T09:30:05.000Z' })
  assert.deepEqual(b, { role: 'assistant', content: 'second', createdAt: '2026-08-31T09:30:09.000Z' })
})

test('persona resolves to its display label; null/unknown fall back to Warm listener', () => {
  assert.equal(buildExportPayload(conv, [], exportedAt).conversation.persona, 'Sharp coach')
  assert.equal(
    buildExportPayload({ ...conv, persona: null }, [], exportedAt).conversation.persona,
    'Warm listener',
  )
  assert.equal(
    buildExportPayload({ ...conv, persona: 'stale-row-value' }, [], exportedAt).conversation.persona,
    'Warm listener',
  )
})

test('string dates are accepted alongside Date objects', () => {
  const p = buildExportPayload(
    { ...conv, createdAt: '2026-08-30T00:00:00.000Z' },
    [{ role: 'user', content: 'hi', createdAt: '2026-08-30T00:00:01.000Z' }],
    exportedAt,
  )
  assert.equal(p.conversation.createdAt, '2026-08-30T00:00:00.000Z')
  assert.equal(p.conversation.messages[0]!.createdAt, '2026-08-30T00:00:01.000Z')
})

test('the builder is pure — inputs are not mutated', () => {
  const shuffled = [msgs[1]!, msgs[0]!]
  buildExportPayload(conv, shuffled, exportedAt)
  assert.deepEqual(shuffled, [msgs[1]!, msgs[0]!])
})
