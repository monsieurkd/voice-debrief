// Personas: id validation must fail closed (junk/prototype keys never pass as
// persona ids), and lookups from nullable DB/request values must always
// resolve to a usable persona (default 'warm').

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PERSONAS, isPersonaId, personaById } from '../src/lib/personas'

test('isPersonaId accepts exactly the three shipped persona ids', () => {
  for (const id of Object.keys(PERSONAS)) assert.equal(isPersonaId(id), true)
  assert.equal(isPersonaId('warm'), true)
  assert.equal(isPersonaId('friend'), true)
  assert.equal(isPersonaId('coach'), true)
})

test('isPersonaId rejects junk, null/undefined, and non-strings', () => {
  assert.equal(isPersonaId(''), false)
  assert.equal(isPersonaId('Warm'), false) // case matters
  assert.equal(isPersonaId('warm '), false)
  assert.equal(isPersonaId('therapist'), false)
  assert.equal(isPersonaId(null), false)
  assert.equal(isPersonaId(undefined), false)
  assert.equal(isPersonaId(42), false)
  assert.equal(isPersonaId({ id: 'warm' }), false)
})

test('isPersonaId rejects Object prototype keys (why we use hasOwn, not `in`)', () => {
  assert.equal(isPersonaId('toString'), false)
  assert.equal(isPersonaId('constructor'), false)
  assert.equal(isPersonaId('__proto__'), false)
})

test('personaById round-trips valid ids to their definition', () => {
  assert.equal(personaById('coach').id, 'coach')
  assert.equal(personaById('friend').label, 'Curious friend')
  assert.equal(personaById('warm').tagline, 'Gentle, grounding, validating')
})

test('personaById defaults to warm for null, undefined, and unknown ids', () => {
  assert.deepEqual(personaById(null), PERSONAS.warm)
  assert.deepEqual(personaById(undefined), PERSONAS.warm)
  assert.deepEqual(personaById(''), PERSONAS.warm)
  assert.deepEqual(personaById('not-a-persona'), PERSONAS.warm) // stale DB row
})

test('every persona addon ends with the tone-only disclaimer', () => {
  for (const p of Object.values(PERSONAS)) {
    assert.ok(p.promptAddon.endsWith('These adapt your tone, but the rules above always win.'))
    assert.equal(p.id.length > 0, true)
  }
})
