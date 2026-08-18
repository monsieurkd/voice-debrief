'use client'

import { useState } from 'react'
import Link from 'next/link'
import { setStepStatus } from '@/actions/debrief'
import type { PlanItem } from '@/lib/queries'

/** The "tomorrow's plan" list — open next_steps with a check-off. */
export function PlanList({ items }: { items: PlanItem[] }) {
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [justDone, setJustDone] = useState<number | null>(null)

  async function markDone(id: number) {
    setBusy(id)
    setError(null)
    try {
      setJustDone(id) // instant feedback; the server re-render then removes it
      await setStepStatus(id, 'done')
    } catch {
      setJustDone(null)
      setError('Could not mark it done — try again.')
    } finally {
      setBusy(null)
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        Nothing on the list.{' '}
        <Link href="/new" className="underline">
          Debrief your day
        </Link>{' '}
        to surface actions.
      </p>
    )
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-1">
      {items.map((p) => (
        <li
          key={p.id}
          className={`group flex items-start gap-2 rounded-md px-2 py-1.5 transition duration-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
            justDone === p.id ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <input
            type="checkbox"
            aria-label={`mark done: ${p.content}`}
            disabled={busy === p.id}
            onChange={() => markDone(p.id)}
            className="mt-1 h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
          />
          <div className="flex flex-col">
            <span
              className={`text-sm leading-6 text-zinc-800 transition dark:text-zinc-200 ${
                justDone === p.id ? '-rotate-1 text-zinc-400 line-through dark:text-zinc-500' : ''
              }`}
            >
              {p.content}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {p.goalTitle && <>→ {p.goalTitle} </>}
              {p.dueOn && <>· due {p.dueOn} </>}
              <Link href={`/session/${p.sessionId}`} className="underline">
                source
              </Link>
            </span>
          </div>
        </li>
      ))}
      </ul>
    </>
  )
}
