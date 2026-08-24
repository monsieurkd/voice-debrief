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
      <p className="text-sm text-on-surface-muted">
        Nothing on the list.{' '}
        <Link href="/new" className="font-medium text-on-secondary-container underline underline-offset-2">
          Debrief your day
        </Link>{' '}
        to surface actions.
      </p>
    )
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-2 text-sm text-error">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {items.map((p) => (
          <li
            key={p.id}
            className={`group flex items-start gap-3 rounded-xl px-3 py-2.5 transition duration-[var(--dur-base)] ease-[var(--ease-standard)] hover:bg-surface-container ${
              justDone === p.id ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <label className="-m-3.5 inline-flex cursor-pointer rounded p-3.5">
              <input
                type="checkbox"
                aria-label={`mark done: ${p.content}`}
                disabled={busy === p.id}
                onChange={() => markDone(p.id)}
                className="mt-1.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-primary"
              />
            </label>
            <div className="flex flex-col">
              <span
                className={`text-sm leading-6 text-on-surface transition ${
                  justDone === p.id ? '-rotate-1 text-on-surface-muted line-through' : ''
                }`}
              >
                {p.content}
              </span>
              <span className="text-xs text-on-surface-muted">
                {p.goalTitle && <>→ {p.goalTitle} </>}
                {p.dueOn && <>· due {p.dueOn} </>}
                <Link href={`/session/${p.sessionId}`} className="underline underline-offset-2">
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
