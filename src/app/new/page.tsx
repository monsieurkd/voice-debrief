'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { runDebrief } from '@/actions/debrief'
import { sampleTranscripts } from '@/lib/sample-transcripts'

export default function NewDebrief() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await runDebrief(text)
      if (res.ok) router.push(`/session/${res.sessionId}`)
      else setError(res.error)
    } catch {
      setError('Could not reach the server — check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-6 py-12">
      <div className="mb-6">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Home
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Debrief your day</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Talk (or type) it out. I&apos;ll organise it into something you can act on.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Today was rough. The standup went sideways…"
          className="min-h-48 w-full resize-y rounded-lg border border-zinc-300 p-4 text-sm leading-6 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
          disabled={pending}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="self-start rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? 'Listening to the structure…' : 'Run debrief'}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Or try a sample</p>
        <div className="flex flex-wrap gap-2">
          {sampleTranscripts.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setText(s.text)}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 transition hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
