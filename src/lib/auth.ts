import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import {
  SESSION_COOKIE,
  GUEST_COOKIE,
  GUEST_TTL_DAYS,
  SESSION_TTL_DAYS,
  signSessionToken,
  signGuestToken,
  verifySessionToken,
  verifyGuestToken,
  type SessionUser,
} from '@/lib/session-token'

/**
 * Server-side session context (the app's Data Access Layer for "who is
 * asking"). The signed cookie proves identity; the DB lookup enforces that
 * the account still exists. `cache()` dedupes the check per request so pages
 * and actions can both call it freely.
 */

export type CurrentUser = SessionUser

/** The signed-in user, or null (bad/absent/expired token, deleted user). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const claims = await verifySessionToken(token)
  if (!claims) return null
  const [row] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, claims.id))
  return row?.email != null ? { id: row.id, email: row.email } : null
})

/** Thrown by requireUser; actions catch it to map to a friendly result. */
export class UnauthorizedError extends Error {
  constructor() {
    super('Not signed in')
    this.name = 'UnauthorizedError'
  }
}

/**
 * The current guest user id from the signed `wim_guest` cookie, or null.
 * A guest is a users row with email/password NULL. Guests debrief first and
 * adopt their data onto a real account later (deferred attribution).
 */
export const getGuestId = cache(async (): Promise<number | null> => {
  const token = (await cookies()).get(GUEST_COOKIE)?.value
  const id = await verifyGuestToken(token)
  if (id == null) return null
  // Keep in sync with reality: a guest who was never created, or already
  // adopted+deleted, no longer exists.
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id))
  return row ? id : null
})

/**
 * Resolve "who is acting": the signed-in real user if present, else ensure (and
 * return) an anonymous guest user. This is the seam that makes debrief-first
 * onboarding work: new visitors can debrief without logging in.
 */
export async function currentUserOrGuest(): Promise<{
  kind: 'user' | 'guest'
  id: number
  email: string | null
}> {
  const real = await getCurrentUser()
  if (real) return { kind: 'user', id: real.id, email: real.email }
  const existing = await getGuestId()
  if (existing != null) return { kind: 'guest', id: existing, email: null }

  // First guest action → mint an anonymous user + signed guest cookie.
  const [g] = await db
    .insert(users)
    .values({ email: null, password_hash: null })
    .returning({ id: users.id })
  const guestId = g!.id
  const store = await cookies()
  store.set(GUEST_COOKIE, await signGuestToken(guestId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * GUEST_TTL_DAYS,
  })
  return { kind: 'guest', id: guestId, email: null }
}

/** Discard the guest cookie (called after their data is adopted onto a real user). */
export async function clearGuestCookie(): Promise<void> {
  const store = await cookies()
  store.delete(GUEST_COOKIE)
}

/**
 * Authorization primitive for server actions: every exported action calls
 * this (or getCurrentUser) before touching data. The proxy route gate is
 * optimistic only and cannot be relied on (Next's own data-security guide).
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthorizedError()
  return user
}

/** Set the session cookie. Only legal inside server actions / route handlers. */
export async function createSessionCookie(user: CurrentUser): Promise<void> {
  const token = await signSessionToken(user)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // plain-http localhost must still work in dev
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * SESSION_TTL_DAYS,
  })
}

/** Clear the session cookie (logout). */
export async function destroySessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}
