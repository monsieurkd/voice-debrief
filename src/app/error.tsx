'use client'

// Route-level error boundary. This Next version's convention passes `retry`
// (renamed from `reset`) — it re-renders the failed segment; router.refresh()
// re-fetches its server data too, since a stale RSC payload would re-throw.
// Never render error.message: prod server errors are masked, but client
// errors pass through verbatim and may leak internals.

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Full details belong in the server logs / console, not the UI.
    console.error('[app] unhandled error:', error)
  }, [error])

  // The shell is height-locked, so this page scrolls itself on short screens.
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-6 py-12">
        <h1 className="text-xl font-semibold tracking-tight text-on-surface">Something broke on our side</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-muted">
          Your words are safe — debriefs are saved before anything downstream runs. Give it another
          moment and try again.
        </p>
        {error.digest && <p className="mt-1 text-xs text-on-surface-muted/80">ref: {error.digest}</p>}
        <div className="mt-6 flex items-center gap-4">
          <Button
            type="button"
            onClick={() => {
              retry()
              router.refresh()
            }}
          >
            Try again
          </Button>
          <Link
            href="/"
            className="text-sm font-medium text-on-secondary-container underline underline-offset-2 transition hover:text-on-surface"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}
