'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { runDebrief } from '@/actions/debrief'
import { sampleTranscripts } from '@/lib/sample-transcripts'
import { DemoButton } from '@/components/DemoButton'
import { MicButton } from '@/components/MicButton'
import { ExtractionProgress } from '@/components/ExtractionProgress'

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
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Type it — or click the mic and just talk.
          </span>
          <MicButton disabled={pending} onFinal={(chunk) => setText((t) => (t ? `${t} ${chunk}` : chunk))} />
        </div>
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
        {pending && <ExtractionProgress />}
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
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Chips fill the box for a real AI run —{' '}
          <DemoButton
            sampleId={0}
            className="font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            or load a sample instantly
          </DemoButton>{' '}
          (demo mode: no AI call, same structured result).
        </p>
      </div>
    </main>
  )
}
