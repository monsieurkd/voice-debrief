// scrypt password hashing: round-trip, uniqueness (per-user salt), wrong
// password, and malformed stored values. Pure node:crypto — no DB, no Next.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword } from '../src/lib/passwd'

test('hash + verify round-trips the right password', async () => {
  const h = await hashPassword('correct horse battery staple')
  assert.match(h, /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/)
  assert.equal(await verifyPassword('correct horse battery staple', h), true)
})

test('a wrong password is rejected', async () => {
  const h = await hashPassword('correct horse battery staple')
  assert.equal(await verifyPassword('correct horse battery stapler', h), false)
  assert.equal(await verifyPassword('', h), false)
  assert.equal(await verifyPassword('Correct horse battery staple', h), false)
})

test('salts are per-hash: same password, different stored values, both verify', async () => {
  const a = await hashPassword('s3cret!')
  const b = await hashPassword('s3cret!')
  assert.notEqual(a, b)
  assert.equal(await verifyPassword('s3cret!', a), true)
  assert.equal(await verifyPassword('s3cret!', b), true)
})

test('malformed stored values fail closed instead of throwing', async () => {
  assert.equal(await verifyPassword('x', ''), false)
  assert.equal(await verifyPassword('x', 'bcrypt:foo:bar'), false)
  assert.equal(await verifyPassword('x', 'scrypt:zz:zz'), false)
  assert.equal(await verifyPassword('x', 'scrypt:0f:0f'), false)
  assert.equal(await verifyPassword('x', 'garbage'), false)
})
