'use client'

import { useEffect, useState } from 'react'
import { GhostLoader } from '@/components/ui'

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
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-4"
    >
      <div className="flex items-center gap-3 text-sm text-on-surface">
        <GhostLoader />
        <span className="flex-1">{stage.label}</span>
        <span className="font-mono text-xs text-on-surface-muted tabular-nums">{elapsed}s</span>
      </div>
      <p className="text-xs text-on-surface-muted">
        You can leave this page — the entry is saved either way, and it&apos;ll be on your journal.
      </p>
    </div>
  )
}
