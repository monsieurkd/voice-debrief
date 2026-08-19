import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { SESSION_COOKIE, SESSION_ISSUER } from '@/lib/session-token'

/**
 * Route gate (Next 16's renamed middleware). Runs before every page request;
 * unauthenticated users are redirected to /login (with a `next` param to come
 * back), signed-in users are bounced off the auth pages.
 *
 * Deliberately self-contained: no DB, no app modules beyond the pure token
 * constants — the proxy docs warn against relying on shared modules/globals.
 * This gate is OPTIMISTIC ONLY: server actions and data loading re-authorize
 * themselves (requireUser / getCurrentUser), because a proxy matcher can
 * silently lose coverage when routes move (see the data-security guide).
 */

const PUBLIC_PATHS = ['/login', '/signup']

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const secret = process.env.AUTH_SECRET
  if (!token || !secret) return false
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'], issuer: SESSION_ISSUER })
    return true
  } catch {
    return false
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (isPublic) {
    if (await hasValidSession(req)) return NextResponse.redirect(new URL('/', req.url))
    return NextResponse.next()
  }

  if (!(await hasValidSession(req))) {
    const login = new URL('/login', req.url)
    if (pathname !== '/') login.searchParams.set('next', pathname)
    return NextResponse.redirect(login)
  }
  return NextResponse.next()
}

export const config = {
  // Everything except Next internals and the auth pages themselves.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|login|signup).*)'],
}
