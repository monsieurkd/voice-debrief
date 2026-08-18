'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { runSampleDebrief } from '@/actions/debrief'

/**
 * Demo mode: stores a pre-baked sample session through the SAME transactional
 * store as a real debrief — but with no LLM call, so it is instant and works
 * without an API key. Used by the empty Home state and /new.
 */
export function LoadSampleButton({
  sampleId = 0,
  className,
  children,
}: {
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
      const res = await runSampleDebrief(sampleId)
      if (res.ok) router.push(`/session/${res.sessionId}`)
      else setError(res.error)
    } catch {
      setError('Could not load the sample — try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button type="button" onClick={run} disabled={pending} className={className}>
        {pending ? 'Loading sample…' : children}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </>
  )
}
