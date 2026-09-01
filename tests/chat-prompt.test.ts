// Prompt composition: the shared core is non-negotiable (every persona keeps
// it, byte-for-byte, first in the system message), the persona only APPENDS a
// tone layer, and the history bound (last 24) still holds.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHAT_SYSTEM_PROMPT, buildChatMessages } from '../src/lib/chat-prompt'
import { PERSONAS, type PersonaId } from '../src/lib/personas'

const history = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `msg ${i}`,
  }))

test('the system message is first and the history follows in order', () => {
  const messages = buildChatMessages(history(3))
  assert.equal(messages[0]!.role, 'system')
  assert.deepEqual(
    messages.slice(1).map((m) => m.content),
    ['msg 0', 'msg 1', 'msg 2'],
  )
})

test('history is bounded to the last 24 messages regardless of persona', () => {
  for (const persona of ['warm', 'friend', 'coach'] as PersonaId[]) {
    const messages = buildChatMessages(history(30), persona)
    assert.equal(messages.length, 25) // 1 system + 24 history
    assert.equal(messages[1]!.content, 'msg 6') // first six dropped
    assert.equal(messages.at(-1)!.content, 'msg 29')
  }
})

test('EVERY persona keeps the shared core, byte-for-byte, before its addon', () => {
  for (const persona of Object.values(PERSONAS)) {
    const system = buildChatMessages(history(1), persona.id)[0]!.content
    assert.ok(system.startsWith(CHAT_SYSTEM_PROMPT))
    assert.ok(system.includes(persona.promptAddon))
    // The addon is appended after the core, separated by a blank line.
    assert.ok(system.startsWith(CHAT_SYSTEM_PROMPT))
    assert.equal(system, `${CHAT_SYSTEM_PROMPT}\n\n${persona.promptAddon}`)
  }
})

test('the non-negotiable core rules survive in every persona variant', () => {
  for (const persona of Object.values(PERSONAS)) {
    const system = buildChatMessages(history(1), persona.id)[0]!.content
    assert.ok(system.includes('Do NOT repeat, paraphrase, or echo back'))
    assert.ok(system.includes('Vary your moves'))
    assert.ok(system.includes('at most one question per turn'))
  }
})

test('different personas produce different system content', () => {
  const warm = buildChatMessages(history(1), 'warm')[0]!.content
  const friend = buildChatMessages(history(1), 'friend')[0]!.content
  const coach = buildChatMessages(history(1), 'coach')[0]!.content
  assert.notEqual(warm, friend)
  assert.notEqual(warm, coach)
  assert.notEqual(friend, coach)
  // …while sharing the exact same core.
  for (const c of [friend, coach]) assert.ok(c.startsWith(CHAT_SYSTEM_PROMPT))
})

test('no persona argument composes the default warm addon', () => {
  const noArg = buildChatMessages(history(1))[0]!.content
  const warm = buildChatMessages(history(1), 'warm')[0]!.content
  assert.equal(noArg, warm)
  assert.ok(noArg.endsWith(PERSONAS.warm.promptAddon))
})
