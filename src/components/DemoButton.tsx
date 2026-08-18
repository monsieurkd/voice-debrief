'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { runSampleDebrief, type DebriefResult } from '@/actions/debrief'

/**
 * Runs a demo action (instant, no LLM) and navigates to the result. Used by the
 * empty Home state and /new. The action comes in as a prop — server actions are
 * serializable references, so server pages can pass theirs directly.
 */
export function DemoButton({
  action,
  dest,
  sampleId,
  className,
  children,
}: {
  action?: () => Promise<DebriefResult>
  dest?: string
  sampleId?: number
  className?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setPending(true)
    setError(null)
    try {
      const res = action ? await action() : await runSampleDebrief(sampleId ?? 0)
      if (res.ok) router.push(dest ?? `/session/${res.sessionId}`)
      else setError(res.error)
    } catch {
      setError('Could not load the demo — try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button type="button" onClick={run} disabled={pending} className={className}>
        {pending ? 'Loading…' : children}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </>
  )
}
