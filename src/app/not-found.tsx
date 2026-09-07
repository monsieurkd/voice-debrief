import Link from 'next/link'

// Shown for notFound() throws (e.g. /session/<unknown-id>) and unmatched
// routes. This is a server component with nothing interactive.
export default function NotFound() {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-6 py-16">
        {/* A floating glass pane so the 404 still reads as part of the calm
            sanctuary, not a lone white void. */}
        <div className="w-full max-w-md rounded-2xl border border-glass-border bg-glass-strong px-8 py-10 text-center backdrop-blur-xl">
          <h1 className="font-display text-2xl leading-snug text-on-surface">
            That page isn&apos;t here
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-on-surface-muted">
            The entry may have been deleted, or the link may never have pointed at anything real.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <Link
              href="/"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-[0_10px_28px_-16px_rgba(40,67,89,0.5)] transition hover:bg-primary-focus active:bg-primary-active"
            >
              Back to Home
            </Link>
            <Link
              href="/chat"
              className="text-sm font-medium text-on-surface-muted underline underline-offset-2 transition hover:text-on-surface"
            >
              Back to your journal
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
