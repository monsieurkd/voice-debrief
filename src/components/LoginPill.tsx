'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The guest "Log in" pill. Includes the current path as `?next=` so that after
 * a debrief-first guest logs in (adopting their anonymous data), they land back
 * on the page they were on — their debrief — instead of Home.
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
      className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-white/60 px-4 py-2 text-sm font-medium text-on-surface-muted backdrop-blur-xl transition hover:bg-white hover:text-on-surface"
    >
      Log in
    </Link>
  )
}
