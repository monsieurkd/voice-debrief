'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { refreshThreads } from '@/actions/debrief'
import type { StoredThread } from '@/lib/threads'
import { SectionTitle, Pill } from '@/components/ui'

const KIND_STYLE: Record<StoredThread['kind'], { dot: string; label: string }> = {
  pattern: { dot: 'bg-secondary-container', label: 'pattern' },
  progress: { dot: 'bg-primary/40', label: 'progress' },
  nudge: { dot: 'bg-error/50', label: 'nudge' },
}

/**
 * "Threads this week" — the cross-day insight panel. The compounding made
 * visible: what connected across days, grounded in dates.
 */
export function ThreadsPanel({ threads, canRefresh }: { threads: StoredThread[]; canRefresh: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onRefresh() {
    setPending(true)
    setError(null)
    try {
      const res = await refreshThreads()
      if (!res.ok) setError(res.error ?? 'Could not refresh threads.')
      else router.refresh()
    } catch {
      setError('Could not refresh threads — try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle className="mb-0 flex-1">Threads this week</SectionTitle>
        {canRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={pending}
            className="text-xs font-medium text-on-secondary-container underline-offset-2 transition hover:underline disabled:opacity-40"
          >
            {pending ? 'Reading your week…' : '↻ refresh'}
          </button>
        )}
      </div>

      {threads.length === 0 ? (
        <p className="text-sm text-on-surface-muted">
          Threads appear once there are a few days to connect — the app reads across debriefs and
          names what keeps coming back, what moved, and what&apos;s still open.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {threads.map((t) => {
            const style = KIND_STYLE[t.kind] ?? KIND_STYLE.pattern!
            return (
              <li
                key={t.id}
                className="rounded-xl bg-surface-container-low p-5 transition hover:bg-surface-container"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
                  <span className="text-sm font-semibold text-on-surface">{t.title}</span>
                  <span className="ml-auto">
                    <Pill>{style.label}</Pill>
                  </span>
                </div>
                <p className="text-sm leading-6 text-on-surface-muted">{t.detail}</p>
                {t.dates.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-1.5">
                    {t.dates.map((d, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-meditative-lavender px-2 py-0.5 text-[11px] text-on-surface-muted"
                      >
                        {d}
                      </span>
                    ))}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      )}
    </section>
  )
}
