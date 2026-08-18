// Pure window-math for the fixed-window limiter (DB behavior is covered by
// scripts/test-ratelimit.ts in the test:db chain).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentWindowStart } from '../src/lib/rate-limit'

const HOUR = 60 * 60 * 1000

test('window start floors to the window boundary', () => {
  assert.equal(currentWindowStart(0, HOUR), 0)
  assert.equal(currentWindowStart(1000, HOUR), 0)
  assert.equal(currentWindowStart(HOUR - 1, HOUR), 0)
  assert.equal(currentWindowStart(HOUR, HOUR), HOUR)
  assert.equal(currentWindowStart(HOUR + 1, HOUR), HOUR)
})

test('all timestamps inside one window share a start', () => {
  const a = currentWindowStart(3 * HOUR + 12345, HOUR)
  const b = currentWindowStart(3 * HOUR + HOUR - 1, HOUR)
  assert.equal(a, 3 * HOUR)
  assert.equal(a, b)
})
