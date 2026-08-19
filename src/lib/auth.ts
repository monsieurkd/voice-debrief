import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import {
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  signSessionToken,
  verifySessionToken,
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

/** Thrown by requireUser — actions catch it to map to a friendly result. */
export class UnauthorizedError extends Error {
  constructor() {
    super('Not signed in')
    this.name = 'UnauthorizedError'
  }
}

/**
 * Authorization primitive for server actions: every exported action calls
 * this (or getCurrentUser) before touching data — the proxy route gate is
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
