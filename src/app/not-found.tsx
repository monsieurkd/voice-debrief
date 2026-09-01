import Link from 'next/link'

// Shown for notFound() throws (e.g. /session/<unknown-id>) and unmatched
// routes. Server component — nothing interactive here.
export default function NotFound() {
  // The shell is height-locked, so this page scrolls itself on short screens.
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-6 py-12">
        <h1 className="text-xl font-semibold tracking-tight text-on-surface">That page isn&apos;t here</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-muted">
          The entry may have been deleted — or the link never pointed at anything real.
        </p>
        <div className="mt-6 flex items-center gap-4">
          {/* Mirrors the Button primitive's azure-gradient pill — the only
              primary action on this page is a link, not a button. */}
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2757c9,#3670f0)] px-5 py-2.5 text-sm font-semibold text-on-primary shadow-[0_10px_30px_-12px_rgba(61,123,255,0.45)] transition duration-[var(--dur-base)] ease-[var(--ease-standard)] hover:bg-[linear-gradient(135deg,#2757c9,#2e63e0)] active:scale-[0.97]"
          >
            Back to Home
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-on-secondary-container underline underline-offset-2 transition hover:text-on-surface"
          >
            Browse your conversations
          </Link>
        </div>
      </div>
    </main>
  )
}
