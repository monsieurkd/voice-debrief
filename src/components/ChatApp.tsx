'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { chatTurnAction } from '@/actions/chat'
import { VoiceRecorder } from '@/components/VoiceRecorder'
import { GhostLoader } from '@/components/ui'

export interface ChatRow {
  role: 'user' | 'assistant'
  content: string
}

/**
 * The ChatGPT-style chat window — the product's single surface.
 * Not card-based: user and assistant turns flow as opening bubbles inside one
 * continuous view, with a bottom composer (text + voice).
 *
 * Voice: the mic (VoiceRecorder) transcribes into the composer; when the
 * server returns TTS audio for an assistant reply, it is played aloud
 * immediately and a per-message "hear it" button replays it.
 */
export function ChatApp({
  initialMessages,
  conversationId: initialConversationId,
}: {
  initialMessages: ChatRow[]
  conversationId?: number
}) {
  const [messages, setMessages] = useState<ChatRow[]>(initialMessages)
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<number | null>(initialConversationId ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  // Pending TTS audio to attach to the newest assistant message.
  const pendingAudioRef = useRef<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  const playBase64 = useCallback((b64: string) => {
    const audio = new Audio(`data:audio/wav;base64,${b64}`)
    void audio.play()
    return audio
  }, [])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busy) return
      setInput('')
      setBusy(true)
      setError(null)

      const userRow: ChatRow = { role: 'user', content: trimmed }
      setMessages((m) => [...m, userRow])

      let replyIndex: number | null = null
      try {
        const res = await chatTurnAction({ message: trimmed, conversationId: conversationId ?? undefined })
        if (res.ok) {
          setConversationId(res.conversationId)
          setMessages((prev) => {
            const reply: ChatRow = { role: 'assistant', content: res.reply }
            const next = [...prev, reply]
            replyIndex = next.length - 1
            return next
          })
          if (res.audio) {
            pendingAudioRef.current = res.audio
            playBase64(res.audio)
            // Set the speaking state on the newest message.
            window.setTimeout(() => setPlayingIndex(replyIndex), 0)
          }
        } else {
          if ('code' in res && res.code === 'rate-limit') {
            setMessages((m) => m.slice(0, -1))
            setInput(trimmed)
          }
          setError(res.error)
        }
      } catch {
        setError('Could not reach the server — check your connection and try again.')
      } finally {
        setBusy(false)
        window.setTimeout(() => setPlayingIndex(null), 400)
      }
    },
    [busy, conversationId, playBase64],
  )

  const replay = useCallback(
    (index: number) => {
      const b64 = pendingAudioRef.current
      if (!b64) return
      setPlayingIndex(index)
      playBase64(b64)
      window.setTimeout(() => setPlayingIndex(null), 400)
    },
    [playBase64],
  )

  const onTranscribed = useCallback((text: string) => {
    setInput((t) => (t ? `${t} ${text}` : text))
  }, [])

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Message view */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-2 pt-16 text-center">
              <p className="font-display text-2xl text-on-surface">How was your day?</p>
              <p className="max-w-md text-sm leading-6 text-on-surface-muted">
                Say it, or type it. I&apos;ll listen, ask what matters, and help you see your day more
                clearly — like a good friend who actually pays attention.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                role={m.role === 'user' ? 'User message' : 'Assistant message'}
                className={
                  m.role === 'user'
                    ? 'max-w-[76%] whitespace-pre-line rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-[15px] leading-6 text-on-primary'
                    : 'max-w-[85%] whitespace-pre-line rounded-2xl rounded-bl-sm bg-white/80 px-4 py-2.5 text-[15px] leading-6 text-on-surface shadow-[0_1px_2px_rgba(87,95,101,0.06)]'
                }
              >
                {m.content}
                {m.role === 'assistant' && (
                  <button
                    type="button"
                    title="Hear this aloud"
                    aria-label="Hear this reply aloud"
                    onClick={() => replay(i)}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-on-surface-muted transition hover:text-on-surface"
                  >
                    {playingIndex === i ? <GhostLoader bars={3} className="h-2.5" /> : <SpeakerIcon />}
                    hear it
                  </button>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white/80 px-4 py-3 text-on-surface-muted">
                <GhostLoader bars={3} />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-center text-sm text-error">
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-outline-variant/50 bg-surface/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            placeholder="Say it here… or press the mic."
            rows={1}
            disabled={busy}
            aria-label="Your message"
            className="max-h-40 flex-1 resize-none rounded-2xl border border-outline-variant bg-white/70 px-4 py-3 text-[15px] leading-6 text-on-surface placeholder:text-on-surface-muted/70 focus:outline-none focus:ring-2 focus:ring-primary-ring"
          />
          <VoiceRecorder disabled={busy} onTranscribed={onTranscribed} compact />
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition hover:bg-primary-focus disabled:opacity-40"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </main>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  )
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}
