import { db } from '@/db/client'
import { rateLimits } from '@/db/schema'
import { lt, sql } from 'drizzle-orm'

/**
 * Fixed-window rate limiter, DB-backed so every serverless instance shares
 * state. Pre-auth abuse control for the public demo (per IP + action).
 * Phase 1 replaces the IP key with per-user limits.
 */

/** The start of the fixed window that contains `now` (pure and unit-tested). */
export function currentWindowStart(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs) * windowMs
}

/**
 * Count this call against `bucket`; return true if still under `limit`.
 * Expired rows are dropped lazily, keeping the table tiny.
 */
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const window_start = new Date(currentWindowStart(nowMs, windowMs))
  await db.delete(rateLimits).where(lt(rateLimits.window_start, new Date(nowMs - windowMs)))
  const [row] = await db
    .insert(rateLimits)
    .values({ bucket, window_start, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.bucket, rateLimits.window_start],
      set: { count: sql`${rateLimits.count} + 1`, updated_at: new Date() },
    })
    .returning({ count: rateLimits.count })
  return (row?.count ?? 1) <= limit
}
