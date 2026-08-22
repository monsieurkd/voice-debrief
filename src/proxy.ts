import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { SESSION_COOKIE, GUEST_COOKIE, SESSION_ISSUER } from '@/lib/session-token'

/**
 * Route gate (Next 16's renamed middleware). Debrief-first routing:
 *
 * - Login/signup stay public (also redirect signed-in/guests away).
 * - `/`, `/new`, and `/interview` are ALWAYS reachable — no identity required —
 *   because the core act of the app (the debrief) must sit in front of any
 *   wall. A brand-new visitor lands straight on the debrief; their first
 *   debrief mints an anonymous guest in `runDebrief`.
 * - Everything else (journal, archive, a session doc) needs a signed identity
 *   cookie: a real session OR an anonymous guest. A guest is a users row whose
 *   data adopts onto an account when they sign up/log in later.
 *
 * Deliberately self-contained: no DB, no app modules beyond the pure token
 * constants — the proxy docs warn against relying on shared modules/globals.
 * This gate is OPTIMISTIC ONLY: server actions and data loading re-authorize
 * themselves (getCurrentUser / currentUserOrGuest), because a proxy matcher can
 * silently lose coverage when routes move (see the data-security guide).
 */

// Always-reachable: the debrief surfaces + the two auth entry points.
const PUBLIC_PATHS = ['/login', '/signup']
const DEBRIEF_FIRST_PATHS = ['/', '/new', '/interview']

function isAllowedWithoutIdentity(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    DEBRIEF_FIRST_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Debrief-first routes + auth pages: no identity required.
  if (isAllowedWithoutIdentity(pathname)) {
    // Bounce signed-in/guest users off the auth pages to the journal.
    if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      const token = req.cookies.get(SESSION_COOKIE)?.value ?? req.cookies.get(GUEST_COOKIE)?.value
      const secret = process.env.AUTH_SECRET
      if (token && secret) {
        try {
          jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'], issuer: SESSION_ISSUER })
          return NextResponse.redirect(new URL('/', req.url))
        } catch {
          /* fall through — treat as anonymous */
        }
      }
    }
    return NextResponse.next()
  }

  // Journal routes require a signed identity (session or guest cookie).
  const token = req.cookies.get(SESSION_COOKIE)?.value ?? req.cookies.get(GUEST_COOKIE)?.value
  const secret = process.env.AUTH_SECRET
  let authorized = false
  if (token && secret) {
    try {
      jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'], issuer: SESSION_ISSUER })
      authorized = true
    } catch {
      authorized = false
    }
  }
  if (!authorized) {
    const login = new URL('/login', req.url)
    if (pathname !== '/') login.searchParams.set('next', pathname)
    return NextResponse.redirect(login)
  }
  return NextResponse.next()
}

export const config = {
  // Must run on everything except Next internals + the auth pages themselves
  // (which we handle above). Static assets are excluded by the matcher.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
