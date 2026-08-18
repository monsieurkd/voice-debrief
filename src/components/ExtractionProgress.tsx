'use client'

import { useEffect, useState } from 'react'

/**
 * Live status during the 30–90s extraction — replaces dead-air button labels
 * with what is actually happening, for how long, and the fact that leaving is
 * safe (the server action stores the session regardless of the redirect).
 * Mount it while pending ({pending && <ExtractionProgress/>}) — mounting is
 * what starts the clock.
 */
const STAGES: { after: number; label: string }[] = [
  { after: 0, label: 'Reading your words…' },
  { after: 8, label: 'Finding the structure — events, decisions, next moves…' },
  { after: 25, label: 'Writing your doc…' },
  { after: 60, label: 'The strong model is still thinking — long entries take a minute…' },
]

export function ExtractionProgress() {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const stage = [...STAGES].reverse().find((s) => elapsed >= s.after)!

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500 dark:bg-zinc-400"
              style={{ animationDelay: `${i * 250}ms` }}
            />
          ))}
        </span>
        {stage.label}
        <span className="ml-auto font-mono text-xs text-zinc-400 tabular-nums">{elapsed}s</span>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        You can leave this page — the entry is saved either way, and it&apos;ll be on Home.
      </p>
    </div>
  )
}
