import { SignJWT, jwtVerify } from 'jose'

/**
 * Stateless signed session token (JWT, HS256) — the pattern this Next version's
 * own authentication guide documents. The cookie carries only {sub, email};
 * the database remains the source of truth for whether the user still exists
 * (checked in lib/auth.ts). No next/* imports here: pure crypto, unit-testable
 * from node:test, and safe to reuse inside proxy.ts if ever needed.
 */

export const SESSION_COOKIE = 'vd_session'
export const SESSION_TTL_DAYS = 30
const ISSUER = 'voice-debrief'

export interface SessionUser {
  id: number
  email: string
}

/** AUTH_SECRET, resolved lazily so tests can rotate it per-case. */
export function authSecret(): string {
  const s = process.env.AUTH_SECRET
  if (!s) {
    throw new Error('AUTH_SECRET is not set. Generate one with `openssl rand -base64 32` and add it to .env.local.')
  }
  return s
}

function key(): Uint8Array {
  return new TextEncoder().encode(authSecret())
}

/** Sign a session token for a user (30-day expiry, HS256). */
export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(key())
}

/**
 * Verify a token → the user it names, or null for anything else (absent,
 * malformed, bad signature, wrong issuer, expired). Callers treat null as
 * "not signed in" and never distinguish causes in responses.
 */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'], issuer: ISSUER })
    const id = Number(payload.sub)
    if (!Number.isInteger(id) || id <= 0 || typeof payload.email !== 'string') return null
    return { id, email: payload.email }
  } catch {
    return null
  }
}
