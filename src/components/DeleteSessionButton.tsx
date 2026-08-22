'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteSessionRow } from '@/actions/debrief'

/**
 * Whole-session delete (GDPR erasure unit). Destructive and NOT undoable —
 * guarded by a confirm() so one mis-tap can't erase a day.
 */
export function DeleteSessionButton({ sessionId }: { sessionId: number }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    if (pending) return
    if (!window.confirm('Delete this whole debrief — rows, tags and transcript? This cannot be undone.')) return
    setPending(true)
    setError(null)
    try {
      await deleteSessionRow(sessionId)
      router.push('/') // the session page is gone; Home revalidated by the action
    } catch {
      setError('Could not delete the session — it is still there. Try again.')
      setPending(false)
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="text-xs text-on-surface-muted transition hover:text-error disabled:opacity-40"
      >
        {pending ? 'deleting…' : 'delete session'}
      </button>
      {error && (
        <small role="alert" className="text-xs text-error">
          {error}
        </small>
      )}
    </span>
  )
}
