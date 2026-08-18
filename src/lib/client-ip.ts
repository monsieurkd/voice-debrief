import { headers } from 'next/headers'

/**
 * Best-effort client IP for the demo rate limiter. On Vercel the platform
 * sets x-forwarded-for; the first hop is the caller. Demo-grade, not
 * adversarial-grade — real per-user limits land with auth (Phase 1).
 */
export async function clientIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}
