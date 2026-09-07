'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The guest "Log in" pill. Includes the current path as `?next=` so that after
 * a debrief-first guest logs in (adopting their anonymous data), they land back
 * on the page they were on (their conversation) instead of Home.
 *
 * `usePathname` is a client API; this tiny component keeps the server-rendered
 * shell free of request-pathname plumbing while preserving SEO of the frame.
 */
export function LoginPill() {
  const pathname = usePathname()
  const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : ''
  return (
    <Link
      href={`/login${next}`}
      className="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-2 text-sm font-medium text-on-surface-variant backdrop-blur-xl transition hover:bg-glass-strong hover:text-on-surface focus-visible:ring-2 focus-visible:ring-secondary-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      Log in
    </Link>
  )
}
