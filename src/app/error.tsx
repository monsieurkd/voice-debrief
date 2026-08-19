'use client'

// Route-level error boundary. This Next version's convention passes `retry`
// (renamed from `reset`) — it re-renders the failed segment; router.refresh()
// re-fetches its server data too, since a stale RSC payload would re-throw.
// Never render error.message: prod server errors are masked, but client
// errors pass through verbatim and may leak internals.

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-start justify-center px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Something broke on our side</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        Your words are safe — debriefs are saved before anything downstream runs. Give it another
        moment and try again.
      </p>
      {error.digest && <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">ref: {error.digest}</p>}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => {
            retry()
            router.refresh()
          }}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Try again
        </button>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          Back to Home
        </Link>
      </div>
    </main>
  )
}
