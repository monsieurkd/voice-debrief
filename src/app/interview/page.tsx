'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { interviewTurnAction, type ChatMsg } from '@/actions/interview'
import { runDebrief } from '@/actions/debrief'
import { MicButton } from '@/components/MicButton'
import { ExtractionProgress } from '@/components/ExtractionProgress'

type Checklist = { events: boolean; decisions: boolean; next_steps: boolean }
const EMPTY: Checklist = { events: false, decisions: false, next_steps: false }
const GREETING = "Hey — how'd today go? Start wherever; I'll listen."

export default function InterviewPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: 'assistant', content: GREETING }])
  const [checklist, setChecklist] = useState<Checklist>(EMPTY)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])

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
    setMessages(history)
    setInput('')
    setPending(true)
    try {
      const res = await interviewTurnAction({ history, checklist })
      if (res.error) {
        setError(res.error) // e.g. demo rate limit — surface why, keep the user's message
        return
      }
      setMessages((h) => [...h, { role: 'assistant', content: res.reply }])
      setChecklist(res.checklist)
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
      if (res.ok) router.push(`/session/${res.sessionId}`)
      else setError(res.error)
    } catch {
      setError('Could not reach the server — try Finish again; your conversation is still here.')
    } finally {
      setFinishing(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-6 py-8">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            ← Home
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Guided debrief</h1>
        </div>
        <button
          onClick={finish}
          disabled={finishing || userTurns === 0}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:border-zinc-900 disabled:opacity-40 dark:border-zinc-700 dark:hover:border-zinc-100"
        >
          {finishing ? 'Wrapping up…' : 'Finish'}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'self-end max-w-[80%] rounded-2xl bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
            }
          >
            {m.content}
          </div>
        ))}
        {pending && (
          <div role="status" className="max-w-[80%] rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-400 dark:bg-zinc-800">
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
          <span className="text-xs text-zinc-400">Covered the main things — Finish whenever.</span>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="mb-2">{finishing && <ExtractionProgress />}</div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex items-end gap-2"
      >
        <MicButton
          compact
          disabled={pending || finishing}
          onFinal={(chunk) => setInput((v) => (v ? `${v} ${chunk}` : chunk))}
        />
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter inserts a newline (chat convention).
            // isComposing guards IME users (e.g. Vietnamese) — their Enter
            // confirms the composition, not the message.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Type your reply — or dictate…"
          className="max-h-40 min-w-0 flex-1 resize-none rounded-lg border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          disabled={pending || finishing}
        />
        <button
          type="submit"
          disabled={pending || finishing || !input.trim()}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Send
        </button>
      </form>
    </main>
  )
}

function Pill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs ${
        on
          ? 'bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
          : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
      }`}
    >
      {label}
    </span>
  )
}
