// Verify the DB-backed rate limiter: allows up to N in a window, denies the
// next, and resets in the following window. Uses a throwaway bucket; exits
// non-zero on failure. Needs a migrated local Postgres.
import assert from 'node:assert/strict'
import { checkRateLimit, currentWindowStart } from '../src/lib/rate-limit'
import { db } from '../src/db/client'
import { rateLimits } from '../src/db/schema'
import { eq } from 'drizzle-orm'

const HOUR = 60 * 60 * 1000

async function main() {
  const bucket = `test:${Date.now()}` // unique per run — parallel-safe
  const t0 = 10 * HOUR + 12345 // arbitrary mid-window instant

  // a 3-per-window bucket: first 3 allowed, 4th denied
  assert.equal(await checkRateLimit(bucket, 3, HOUR, t0), true, 'call 1 allowed')
  assert.equal(await checkRateLimit(bucket, 3, HOUR, t0 + 5000), true, 'call 2 allowed')
  assert.equal(await checkRateLimit(bucket, 3, HOUR, t0 + 9999), true, 'call 3 allowed')
  assert.equal(await checkRateLimit(bucket, 3, HOUR, t0 + 12345), false, 'call 4 denied (limit 3)')

  // next window: counter resets
  const t1 = currentWindowStart(t0, HOUR) + HOUR + 1
  assert.equal(await checkRateLimit(bucket, 3, HOUR, t1), true, 'first call of next window allowed')

  // a different bucket is independent
  assert.equal(await checkRateLimit(`${bucket}-b`, 3, HOUR, t0), true, 'separate bucket unaffected')

  await db.delete(rateLimits).where(eq(rateLimits.bucket, bucket))
  console.log('✅ rate limiter verified: allow N, deny N+1, reset next window')
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ rate-limit test failed:', e)
  process.exit(1)
})
