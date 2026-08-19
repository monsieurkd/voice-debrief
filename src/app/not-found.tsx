import Link from 'next/link'

// Shown for notFound() throws (e.g. /session/<unknown-id>) and unmatched
// routes. Server component — nothing interactive here.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-start justify-center px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">That page isn&apos;t here</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        The entry may have been deleted — or the link never pointed at anything real.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Back to Home
        </Link>
        <Link href="/archive" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          Browse the archive
        </Link>
      </div>
    </main>
  )
}
