'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { interviewTurnAction, type ChatMsg } from '@/actions/interview'
import { runDebrief } from '@/actions/debrief'
import { VoiceRecorder } from '@/components/VoiceRecorder'
import { ExtractionProgress } from '@/components/ExtractionProgress'
import { getInitialDraft, saveDraft, clearDraft, type InterviewChecklist } from '@/lib/interview-draft'
import { Button, GhostButton } from '@/components/ui'

const EMPTY: InterviewChecklist = { events: false, decisions: false, next_steps: false }
const GREETING = "Hey — how'd today go? Start wherever; I'll listen."
const GREETING_MSG: ChatMsg = { role: 'assistant', content: GREETING }

// SSR-safe pattern: read client-only storage through useSyncExternalStore
// (server snapshot is null → no hydration mismatch).
const emptySubscribe = () => () => {}

export default function InterviewPage() {
  const router = useRouter()
  // Survive a refresh or a closed window: the conversation restores from
  // localStorage (draft) until the user's first turn moves it into state.
  const draft = useSyncExternalStore(emptySubscribe, getInitialDraft, () => null)
  const [liveMessages, setLiveMessages] = useState<ChatMsg[] | null>(null)
  const [liveChecklist, setLiveChecklist] = useState<InterviewChecklist | null>(null)
  // Memoized: these feed effect deps below — raw logical expressions would
  // mint a new [] every render and re-run the save effect forever.
  const messages = useMemo<ChatMsg[]>(() => liveMessages ?? draft?.messages ?? [GREETING_MSG], [liveMessages, draft])
  const checklist = useMemo<InterviewChecklist>(
    () => liveChecklist ?? draft?.checklist ?? EMPTY,
    [liveChecklist, draft],
  )
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Keep the draft in sync every turn — but never overwrite a real draft with
  // the pristine greeting (the pre-first-turn render).
  useEffect(() => {
    if (messages.length === 1 && messages[0].content === GREETING) return
    saveDraft(messages, checklist)
  }, [messages, checklist])

  // Auto-grow the composer to its content (capped), so long replies stay
  // visible instead of scrolling inside a one-line input.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const userTurns = messages.filter((m) => m.role === 'user').length
  const allCovered = checklist.events && checklist.decisions && checklist.next_steps

  async function submit() {
    const text = input.trim()
    if (!text || pending || finishing) return
    setError(null)
    const history: ChatMsg[] = [...messages, { role: 'user', content: text }]
    setLiveMessages(history)
    setInput('')
    setPending(true)
    try {
      const res = await interviewTurnAction({ history, checklist })
      if (res.error) {
        setError(res.error) // e.g. demo rate limit — surface why, keep the user's message
        return
      }
      setLiveMessages([...history, { role: 'assistant', content: res.reply }])
      setLiveChecklist(res.checklist)
    } catch {
      setError('Hiccup reaching the model — try again, or hit Finish to wrap up.')
    } finally {
      setPending(false)
    }
  }

  async function finish() {
    setError(null)
    const transcript = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n\n')
    if (!transcript.trim()) {
      setError('Say a few words first.')
      return
    }
    setFinishing(true)
    try {
      const res = await runDebrief(transcript)
      if (res.ok) {
        clearDraft() // the conversation became a session — a revisit starts fresh
        router.push(`/session/${res.sessionId}`)
      } else {
        setError(res.error)
      }
    } catch {
      setError('Could not reach the server — try Finish again; your conversation is still here.')
    } finally {
      setFinishing(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[820px] flex-col px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/new" className="text-sm text-on-surface-muted transition hover:text-on-surface">
            ← Back
          </Link>
          <h1 className="mt-1 font-display text-2xl text-on-surface">Guided debrief</h1>
        </div>
        <GhostButton onClick={finish} disabled={finishing || userTurns === 0}>
          {finishing ? 'Wrapping up…' : 'Finish'}
        </GhostButton>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'self-end max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-sm text-on-primary'
                : 'max-w-[85%] rounded-2xl bg-surface-container-low px-4 py-2 text-sm text-on-surface'
            }
          >
            {m.content}
          </div>
        ))}
        {pending && (
          <div role="status" className="max-w-[80%] rounded-2xl bg-surface-container-low px-4 py-2 text-sm text-on-surface-muted">
            …
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill on={checklist.events} label="what happened" />
        <Pill on={checklist.decisions} label="decided" />
        <Pill on={checklist.next_steps} label="next move" />
        {(allCovered || userTurns >= 8) && (
          <span className="text-xs text-on-surface-muted">Covered the main things — Finish whenever.</span>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="mb-2">{finishing && <ExtractionProgress />}</div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          <VoiceRecorder
            compact
            disabled={pending || finishing}
            onTranscribed={(text) => setInput((v) => (v ? `${v} ${text}` : text))}
          />
          <span className="text-xs text-on-surface-muted">or record and it&apos;s typed here</span>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Type your reply…"
            className="ambient-field max-h-40 min-w-0 flex-1 resize-none py-2.5 text-sm text-on-surface placeholder:text-on-surface-muted/70"
            disabled={pending || finishing}
          />
          <Button type="submit" disabled={pending || finishing || !input.trim()}>
            Send
          </Button>
        </div>
      </form>
    </main>
  )
}

function Pill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        on
          ? 'bg-secondary-container text-on-secondary-container'
          : 'bg-meditative-lavender text-on-surface-muted'
      }`}
    >
      {label}
    </span>
  )
}
