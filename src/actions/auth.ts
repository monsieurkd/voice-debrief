'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { env } from '@/lib/env'
import { parseArgs } from '@/lib/action-args'
import { hashPassword, verifyPassword } from '@/lib/passwd'
import { createSessionCookie, destroySessionCookie } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { clientIp } from '@/lib/client-ip'
import { RATE_WINDOW_MS } from '@/lib/constants'

/**
 * Email + password auth actions. Public entry points (no session required),
 * so each one rate-limits by IP first — these are the unauthenticated attack
 * surface. Form results come back as { error } via useActionState instead of
 * thrown errors, so a mistyped password never trips an error boundary.
 */

export type AuthFormState = { error?: string }

const credentialsSchema = z.object({
  email: z.email().trim().toLowerCase().max(200),
  password: z.string().min(8, 'at least 8 characters').max(200),
})

/** parseArgs but form-friendly: returns null (after logging) instead of throwing. */
function parseCreds(formData: FormData): z.infer<typeof credentialsSchema> | null {
  try {
    return parseArgs(
      credentialsSchema,
      { email: formData.get('email'), password: formData.get('password') },
      'auth-credentials',
    )
  } catch {
    return null
  }
}

/** Only redirect to paths inside this app — never protocol-relative/external. */
function safeNext(next: FormDataEntryValue | null): string {
  const s = typeof next === 'string' ? next : ''
  return s.startsWith('/') && !s.startsWith('//') ? s : '/'
}

// Fixed-cost hash so "unknown email" and "wrong password" take the same time.
let dummyHash: string | null = null
async function burnDummyVerify(password: string): Promise<void> {
  dummyHash ??= await hashPassword('timing-equalizer-placeholder')
  await verifyPassword(password, dummyHash)
}

export async function signupAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const a = parseCreds(formData)
  if (!a) return { error: 'Enter a valid email and a password of at least 8 characters.' }
  if (!env.AUTH_SECRET) {
    console.error('[signup] AUTH_SECRET is not set')
    return { error: 'Sign-up is disabled — the server is missing its AUTH_SECRET configuration.' }
  }
  if (!(await checkRateLimit(`signup:${await clientIp()}`, 5, RATE_WINDOW_MS))) {
    return { error: 'Too many sign-up attempts from this network — try again in an hour.' }
  }

  const password_hash = await hashPassword(a.password)
  let id: number
  try {
    // users.id is `generated always as identity` — never insert an explicit id.
    const [u] = await db.insert(users).values({ email: a.email, password_hash }).returning({ id: users.id })
    id = u!.id
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return { error: 'That email is already registered — log in instead.' }
    console.error('[signup] insert failed:', e)
    return { error: 'Could not create the account — please try again.' }
  }

  await createSessionCookie({ id, email: a.email })
  redirect(safeNext(formData.get('next')))
}

export async function loginAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const a = parseCreds(formData)
  if (!a) return { error: 'Enter a valid email and a password of at least 8 characters.' }
  if (!env.AUTH_SECRET) {
    console.error('[login] AUTH_SECRET is not set')
    return { error: 'Login is disabled — the server is missing its AUTH_SECRET configuration.' }
  }
  if (!(await checkRateLimit(`login:${await clientIp()}`, 10, RATE_WINDOW_MS))) {
    return { error: 'Too many attempts — wait an hour and try again.' }
  }

  const [u] = await db.select().from(users).where(eq(users.email, a.email))
  if (!u || !u.password_hash) {
    await burnDummyVerify(a.password) // same work as a real check → no user enumeration
    return { error: 'Wrong email or password.' }
  }
  if (!(await verifyPassword(a.password, u.password_hash))) return { error: 'Wrong email or password.' }

  await createSessionCookie({ id: u.id, email: u.email! })
  redirect(safeNext(formData.get('next')))
}

export async function logoutAction(): Promise<void> {
  await destroySessionCookie()
  redirect('/login')
}
