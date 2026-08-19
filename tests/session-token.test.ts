// Session JWTs: sign/verify round-trip, and every way a token must fail
// closed (tampered, wrong secret, expired, absent, malformed).
// AUTH_SECRET is read lazily at call time — set before any assertion runs.
process.env.AUTH_SECRET = 'test-secret-do-not-use-in-prod'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signSessionToken, verifySessionToken, authSecret } from '../src/lib/session-token'

test('sign + verify round-trips the user', async () => {
  const t = await signSessionToken({ id: 42, email: 'a@example.com' })
  assert.deepEqual(await verifySessionToken(t), { id: 42, email: 'a@example.com' })
})

test('tampering with the payload fails verification', async () => {
  const t = await signSessionToken({ id: 42, email: 'a@example.com' })
  const [h, p, s] = t.split('.')
  const forged = JSON.parse(Buffer.from(p, 'base64url').toString())
  forged.sub = '1' // escalate to another user id
  const tampered = [h, Buffer.from(JSON.stringify(forged)).toString('base64url'), s].join('.')
  assert.equal(await verifySessionToken(tampered), null)
})

test('a token signed with a different secret is rejected', async () => {
  const t = await signSessionToken({ id: 42, email: 'a@example.com' })
  process.env.AUTH_SECRET = 'a-different-secret'
  try {
    assert.equal(await verifySessionToken(t), null)
  } finally {
    process.env.AUTH_SECRET = 'test-secret-do-not-use-in-prod'
  }
})

test('absent / malformed input is rejected, not thrown', async () => {
  assert.equal(await verifySessionToken(undefined), null)
  assert.equal(await verifySessionToken(''), null)
  assert.equal(await verifySessionToken('not-a-jwt'), null)
})

test('expired tokens are rejected', async () => {
  // Expiry is baked in at 30d — instead of waiting, forge an already-expired
  // token with the same claims shape the verifier expects.
  const { SignJWT } = await import('jose')
  const key = new TextEncoder().encode(authSecret())
  const expired = await new SignJWT({ email: 'a@example.com' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('42')
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(key)
  assert.equal(await verifySessionToken(expired), null)
})

test('claims without a usable sub or email are rejected', async () => {
  const { SignJWT } = await import('jose')
  const key = new TextEncoder().encode(authSecret())
  const noSub = await new SignJWT({ email: 'a@example.com' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('voice-debrief')
    .setExpirationTime('1d')
    .sign(key)
  assert.equal(await verifySessionToken(noSub), null)
})
