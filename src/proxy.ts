import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { SESSION_COOKIE, GUEST_COOKIE, SESSION_ISSUER } from '@/lib/session-token'

/**
 * Route gate (Next 16's renamed middleware). Debrief-first routing:
 *
 * - Login/signup stay public (also redirect signed-in/guests away).
 * - `/`, `/chat`, and `/new` are ALWAYS reachable with no identity required.
 *   because the core act of the app (the debrief) must sit in front of any
 *   wall. A brand-new visitor lands straight on the debrief; their first
 *   debrief mints an anonymous guest in `runDebrief`.
 * - Everything else (journal, archive, a session doc) needs a signed identity
 *   cookie: a real session OR an anonymous guest. A guest is a users row whose
 *   data adopts onto an account when they sign up/log in later.
 *
 * Deliberately self-contained: no DB, no app modules beyond the pure token
 * constants because the proxy docs warn against relying on shared modules/globals.
 * This gate is OPTIMISTIC ONLY: server actions and data loading re-authorize
 * themselves (getCurrentUser / currentUserOrGuest), because a proxy matcher can
 * silently lose coverage when routes move (see the data-security guide).
 */

// Always-reachable: the debrief surfaces, the two auth entry points, and the
// public mission page (a brand-new visitor must be able to read about What I Mean
// without an account).
const PUBLIC_PATHS = ['/login', '/signup']
const DEBRIEF_FIRST_PATHS = ['/', '/chat', '/new']
const PUBLIC_MISSION_PATHS = ['/about']

export function isAllowedWithoutIdentity(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    DEBRIEF_FIRST_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    PUBLIC_MISSION_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Debrief-first routes + auth pages: no identity required.
  if (isAllowedWithoutIdentity(pathname)) {
    // Bounce users who are SIGNED IN off the auth pages to the journal. A
    // valid guest cookie must NOT bounce: a guest is exactly who needs to
    // reach /login or /signup to adopt their debriefs onto a real account (the
    // deferred-attribution contract). The page-level getCurrentUser() check
    // already sends signed-in users away safely. This proxy guard is just an
    // optimizer for the signed-in case, and must only look at the SESSION
    // cookie, never the guest cookie.
    if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      const token = req.cookies.get(SESSION_COOKIE)?.value
      const secret = process.env.AUTH_SECRET
      if (token && secret) {
        try {
          jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'], issuer: SESSION_ISSUER })
          return NextResponse.redirect(new URL('/', req.url))
        } catch {
          /* Fall through and treat as anonymous. */
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
