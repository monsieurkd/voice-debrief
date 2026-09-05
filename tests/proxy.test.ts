import assert from 'node:assert/strict'
import test from 'node:test'
import { isAllowedWithoutIdentity } from '../src/proxy'

test('the chat can start without an existing identity', () => {
  assert.equal(isAllowedWithoutIdentity('/chat'), true)
  assert.equal(isAllowedWithoutIdentity('/chat/'), true)
})

test('private journal routes still require an identity', () => {
  assert.equal(isAllowedWithoutIdentity('/journal'), false)
  assert.equal(isAllowedWithoutIdentity('/sessions/example'), false)
})
