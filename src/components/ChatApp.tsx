'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { chatTurnAction } from '@/actions/chat'
import { VoiceRecorder } from '@/components/VoiceRecorder'
import { GhostLoader } from '@/components/ui'
import { PERSONAS, type PersonaId } from '@/lib/personas'

export interface ChatRow {
  role: 'user' | 'assistant'
  content: string
}

/**
 * The What I Mean chat window: the product's single surface.
 *
 * One continuous conversation view on the deep-blue glass canvas: the assistant
 * carries an animated "listener" orb (pure CSS; the same orb-breathe/ripple
 * language as the design tokens), messages glass over the canvas, and the
 * composer sits as a floating-glass dock so it never feels cramped against the
 * edge. Voice and send are two equal pill controls.
 *
 * Voice: the mic (VoiceRecorder) transcribes into the composer. When the server
 * returns TTS audio for a reply, the client plays it automatically, like a real
 * conversation, while the orb "speaks." No per-message replays.
 */
export function ChatApp({
  initialMessages,
  conversationId: initialConversationId,
  initialPersona = 'warm',
  onPersonaChange,
}: {
  initialMessages: ChatRow[]
  conversationId?: number
  /** The voice to apply to the FIRST turn that creates a conversation. After
   *  that the server's stored persona is authoritative (matches chat action). */
  initialPersona?: PersonaId
  onPersonaChange?: (persona: PersonaId, conversationId: number | null) => void | Promise<void>
}) {
  const [messages, setMessages] = useState<ChatRow[]>(initialMessages)
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<number | null>(initialConversationId ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const personaRef = useRef(initialPersona)

  useEffect(() => {
    personaRef.current = initialPersona
  }, [initialPersona])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  const playBase64 = useCallback((b64: string) => {
    // Stop any in-flight auto-speech before starting the next one.
    audioRef.current?.pause()
    const audio = new Audio(`data:audio/wav;base64,${b64}`)
    audioRef.current = audio
    audio.onended = () => setSpeaking(false)
    setSpeaking(true)
    void audio.play()
  }, [])

  // Auto-speak: a real conversation says the reply out loud, so no per-message
  // "hear it" button is needed.
  useEffect(() => () => audioRef.current?.pause(), [])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busy) return
      setInput('')
      setBusy(true)
      setError(null)

      const userRow: ChatRow = { role: 'user', content: trimmed }
      setMessages((m) => [...m, userRow])

      try {
        const res = await chatTurnAction({
          message: trimmed,
          conversationId: conversationId ?? undefined,
          // Only meaningful for the turn that creates the conversation; the
          // server ignores it once a conversation id is stored.
          persona: conversationId == null ? personaRef.current : undefined,
        })
        if (res.ok) {
          setConversationId(res.conversationId)
          setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }])
          if (res.audio) playBase64(res.audio)
        } else {
          if ('code' in res && res.code === 'rate-limit') {
            setMessages((m) => m.slice(0, -1))
            setInput(trimmed)
          }
          setError(res.error)
        }
      } catch {
        setError('Could not reach the server. Check your connection and try again.')
      } finally {
        setBusy(false)
      }
    },
    [busy, conversationId, playBase64],
  )

  const onTranscribed = useCallback((text: string) => {
    setInput((t) => (t ? `${t} ${text}` : text))
  }, [])

  return (
    <main className="flex h-full flex-col">
      {/* Message view */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-6 pt-10 text-center sm:pt-16">
              {/* The listener, the "person on the other side". Pure CSS orb. */}
              <ListenerOrb persona={initialPersona} speaking={busy} />
              <div className="flex flex-col items-center gap-2">
                <p className="font-display text-2xl text-on-surface">I&apos;m here. How was your day?</p>
                <p className="max-w-md text-sm leading-6 text-on-surface-muted">
                  <span className="font-medium text-on-surface">{PERSONAS[initialPersona].label} · </span>
                  Speak it, or type it. I&apos;ll listen, ask what matters, and help you see your day more
                  clearly, just like a good friend who actually pays attention.
                </p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`group flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
              style={{ animation: 'msg-in 320ms cubic-bezier(0.4,0,0.2,1)' }}
            >
              {/* Avatar column */}
              {m.role === 'assistant' && (
                <div className="mt-1 shrink-0">
                  <ListenerOrbMini persona={initialPersona} speaking={i === messages.length - 1 && speaking} />
                </div>
              )}

              {/* Bubble */}
              <div
                role={m.role === 'user' ? 'User message' : 'Assistant message'}
                className={
                  m.role === 'user'
                    ? 'max-w-[76%] whitespace-pre-line rounded-3xl rounded-tr-md bg-primary px-4 py-2.5 text-[15px] leading-6 text-on-primary shadow-[0_12px_28px_-16px_rgba(40,67,89,0.5)]'
                    : 'max-w-[85%] whitespace-pre-line rounded-3xl rounded-tl-md border border-glass-border bg-glass px-4 py-2.5 text-[15px] leading-6 text-on-surface backdrop-blur-xl'
                }
              >
                {m.content}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex gap-3">
              <div className="mt-1 shrink-0">
                <ListenerOrbMini persona={initialPersona} speaking />
              </div>
              <div className="flex items-center gap-2 rounded-3xl rounded-tl-md border border-glass-border bg-glass px-4 py-3 text-on-surface-muted backdrop-blur-xl">
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

      {/* Composer, a floating-glass dock, not a cramped strip against the edge. */}
      <div className="border-t border-glass-border bg-surface/70 px-3 pb-6 pt-3 backdrop-blur-xl sm:px-6 sm:pb-5">
        <div className="mx-auto w-full max-w-2xl rounded-3xl border border-glass-border bg-glass p-2 shadow-[0_14px_34px_-22px_rgba(39,76,103,0.4)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-glass-border px-2 pb-2 pt-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-muted">
              Voice
            </span>
            <select
              value={initialPersona}
              onChange={(event) => {
                const persona = event.target.value as PersonaId
                personaRef.current = persona
                void onPersonaChange?.(persona, conversationId)
              }}
              disabled={busy}
              aria-label="Conversation voice"
              title={`${PERSONAS[initialPersona].tagline}. Applies from the next message`}
              className={`min-w-0 rounded-full border px-3 py-1 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-secondary-focus-ring disabled:opacity-50 ${PERSONAS[initialPersona].chip}`}
            >
              {Object.values(PERSONAS).map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pl-3 pt-1">
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
              className="max-h-40 min-w-0 flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-on-surface placeholder:text-on-surface-muted/70 focus:outline-none"
            />
            {/* Mic + Send as two equal, symmetric pill controls. */}
            <div className="flex shrink-0 items-center gap-2">
              <VoiceRecorder disabled={busy} onTranscribed={onTranscribed} variant="glass" />
              <button
                type="button"
                onClick={() => void send(input)}
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_12px_26px_-12px_rgba(42,67,89,0.65)] ring-1 ring-primary-ring/40 ring-offset-2 ring-offset-glass transition hover:bg-primary-focus focus-visible:ring-2 focus-visible:ring-primary-ring disabled:opacity-40"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

/**
 * The primary "listener", a large breathing orb with a soft rippling halo and
 * a subtle ring. Its fill is the current voice's persona aura (warm = lavender,
 * friend = sage, coach = slate-blue), so the reviewer-facing identity is also
 * visual. Pure CSS (uses the design-token keyframes) and no image asset. The
 * drop shadow stays a neutral ink so the persona hue reads calm, not neon.
 */
function ListenerOrb({ persona = 'warm', speaking = false }: { persona?: PersonaId; speaking?: boolean }) {
  const label = PERSONAS[persona].label
  return (
    <div
      role="img"
      aria-label={`${label}, a calm listener on the other side`}
      className="relative grid place-items-center"
    >
      {/* Rippling halo ring */}
      <span
        aria-hidden
        className="absolute h-28 w-28 rounded-full border border-outline-variant/70"
        style={{ animation: 'orb-ripple 3.2s ease-out infinite' }}
      />
      <span
        aria-hidden
        className="absolute h-20 w-20 rounded-full border border-outline-variant/60"
        style={{ animation: 'orb-ripple 3.2s ease-out 1.1s infinite' }}
      />
      {/* The orb itself */}
      <span
        aria-hidden
        className="grid h-24 w-24 place-items-center rounded-full shadow-[0_10px_28px_-14px_rgba(2,8,24,0.35)]"
        style={{
          background: PERSONAS[persona].aura,
          animation: speaking ? 'orb-pulse 1.2s ease-in-out infinite' : 'orb-breathe 4s ease-in-out infinite',
        }}
      >
        {/* Facial hint, two soft eyes so it reads as a "person talking". */}
        <span className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-white/95" />
          <span className="h-2 w-2 rounded-full bg-white/95" />
        </span>
      </span>
      {/* Rotating dashed decoration ring */}
      <span
        aria-hidden
        className="absolute h-32 w-32 rounded-full border border-dashed border-outline-variant/60"
        style={{ animation: 'orb-spin 18s linear infinite' }}
      />
    </div>
  )
}

/** The compact orb shown beside each assistant bubble (and loading state). */
function ListenerOrbMini({ persona = 'warm', speaking = false }: { persona?: PersonaId; speaking?: boolean }) {
  const label = PERSONAS[persona].label
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-full shadow-[0_4px_12px_-6px_rgba(2,8,24,0.3)]"
      style={{
        background: PERSONAS[persona].aura,
        animation: speaking ? 'orb-pulse 1s ease-in-out infinite' : 'none',
      }}
    >
      <span className="flex items-center gap-[3px]">
        <span className="h-[4px] w-[4px] rounded-full bg-white/95" />
        <span className="h-[4px] w-[4px] rounded-full bg-white/95" />
      </span>
    </span>
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
