'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { refreshThreads } from '@/actions/debrief'
import type { StoredThread } from '@/lib/threads'

const KIND_STYLE: Record<StoredThread['kind'], { dot: string; label: string }> = {
  pattern: { dot: 'bg-indigo-400', label: 'pattern' },
  progress: { dot: 'bg-emerald-400', label: 'progress' },
  nudge: { dot: 'bg-amber-400', label: 'nudge' },
}

/**
 * "Threads this week" — the cross-day insight panel. This is where the
 * compounding becomes visible: what connected across days, grounded in dates.
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
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="border-b border-zinc-200 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 dark:border-zinc-800">
          Threads this week
        </h2>
        {canRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={pending}
            className="text-xs text-zinc-500 underline-offset-2 transition hover:text-zinc-900 hover:underline disabled:opacity-40 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {pending ? 'Reading your week…' : '↻ refresh'}
          </button>
        )}
      </div>

      {threads.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Threads appear once there are a few days to connect — the app reads across debriefs and
          names what keeps coming back, what moved, and what&apos;s still open.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {threads.map((t) => {
            const style = KIND_STYLE[t.kind] ?? KIND_STYLE.pattern!
            return (
              <li
                key={t.id}
                className="rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.title}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-400">{style.label}</span>
                </div>
                <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{t.detail}</p>
                {t.dates.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-1.5">
                    {t.dates.map((d, i) => (
                      <span key={i} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
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
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  )
}
