'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { runDebrief } from '@/actions/debrief'
import { sampleTranscripts } from '@/lib/sample-transcripts'
import { DemoButton } from '@/components/DemoButton'
import { VoiceRecorder } from '@/components/VoiceRecorder'
import { ExtractionProgress } from '@/components/ExtractionProgress'
import { AmbientTextarea, Button, Card, GhostLoader } from '@/components/ui'

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
    <main className="mx-auto w-full max-w-[920px] px-6 py-12">
      <header className="mb-10 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-muted">No sign-in needed</p>
        <h1 className="font-display text-3xl text-on-surface sm:text-4xl">Debrief your day</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-on-surface-muted">
          Talk (or type) it out — I&apos;ll organise it into something you can act on. Save it to a
          journal whenever you&apos;re ready.
        </p>
        <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-on-surface-muted">
          🎙 Record and your clip is transcribed — voice works in every browser.
        </p>
      </header>

      <Card className="p-6 sm:p-8">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-on-surface-muted">Type it — or record and I&apos;ll transcribe.</span>
            <VoiceRecorder
              disabled={pending}
              onTranscribed={(text) => setText((t) => (t ? `${t} ${text}` : text))}
            />
          </div>
          <AmbientTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Today was rough. The standup went sideways…"
            rows={8}
            disabled={pending}
            aria-label="Your debrief text"
          />
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
          {pending && <ExtractionProgress />}
          <Button type="submit" disabled={pending || !text.trim()} className="self-start">
            {pending ? <><GhostLoader /> Listening to the structure…</> : 'Run debrief'}
          </Button>
        </form>

        <div className="mt-8 border-t border-outline-variant/50 pt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-on-surface-muted">Or try a sample</p>
          <div className="flex flex-wrap gap-2">
            {sampleTranscripts.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setText(s.text)}
                className="rounded-full bg-meditative-lavender px-3 py-1.5 text-xs font-medium text-on-surface-muted transition hover:text-on-surface"
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-on-surface-muted">
            Chips fill the box for a real AI run —{' '}
            <DemoButton
              sampleId={0}
              className="font-medium text-on-secondary-container underline underline-offset-2 hover:text-on-surface"
            >
              or load a sample instantly
            </DemoButton>{' '}
            (demo mode: no AI call, same structured result).
          </p>
        </div>
      </Card>

      {/* /new is the single, self-contained entry point of the app — nothing after it. */}
    </main>
  )
}
