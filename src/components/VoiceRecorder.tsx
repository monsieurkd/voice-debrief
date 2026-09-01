'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { transcribeAudioAction } from '@/actions/voice'
import { decodeToMono16k, floatToWav } from '@/lib/webm-to-wav'

/**
 * Cross-browser batch voice capture (the server-side STT path). This is the
 * one voice input: MediaRecorder + getUserMedia works on Safari/Firefox/iOS
 * (the removed live-dictation mic was Chromium-only Web Speech).
 *
 * Flow: click to start → record (live elapsed timer, cancellable) → click to
 * stop → the clip uploads to transcribeAudioAction → onTranscribed(text) feeds
 * the existing transcript pipeline (the /new composer).
 *
 * Renders nothing where the browser lacks getUserMedia/MediaRecorder. Support
 * and the "would recording even work" flag are read through useSyncExternalStore
 * so the server snapshot is stable (no hydration mismatch).
 */

const emptySubscribe = () => () => {}

function browserSupportsCapture(): boolean {
  if (typeof window === 'undefined') return false
  return typeof window.MediaRecorder !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
}

type Status = 'idle' | 'record' | 'transcribing'

export function VoiceRecorder({
  onTranscribed,
  onTranscriptFailed,
  disabled,
  compact,
  variant = 'light',
}: {
  /** Called with the transcribed text whenever a clip finishes successfully. */
  onTranscribed: (text: string) => void
  /** Called when a clip can't be transcribed (beyond a generic whisper). */
  onTranscriptFailed?: (error: string) => void
  disabled?: boolean
  compact?: boolean
  /** 'light' = the legacy white chip; 'glass' = the dark-glass composer look. */
  variant?: 'light' | 'glass'
}) {
  const supported = useSyncExternalStore(emptySubscribe, browserSupportsCapture, () => false)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastMimeRef = useRef('')

  // Cleanup on unmount — never leave a mic open.
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current?.state === 'recording') {
        try {
          mediaRecorderRef.current.stop()
        } catch {
          /* already stopped */
        }
      }
      stopStream()
    }
  }, [stopStream])

  const reset = useCallback(() => {
    setStatus('idle')
    setElapsed(0)
    setError(null)
    chunksRef.current = []
  }, [])

  const upload = useCallback(
    async (chunks: Blob[], mime: string) => {
      if (!chunks.length) {
        setError('Nothing was recorded — try again.')
        setStatus('idle')
        return
      }
      const blob = new Blob(chunks, { type: mime })
      setStatus('transcribing')
      try {
        // Groq/Whisper reject WebM/Opus (and sometimes MP4); WAV is universally
        // accepted. Transcode the recorded (compressed) clip to mono 16k PCM WAV
        // before upload so transcription works regardless of recorder container.
        const samples = await decodeToMono16k(blob)
        const wav = floatToWav(samples)
        const res = await transcribeAudioAction({ file: wav, filename: 'recording.wav' })
        if (res.ok) {
          onTranscribed(res.text)
          reset()
        } else {
          setError(res.error)
          setStatus('idle')
          onTranscriptFailed?.(res.error)
        }
      } catch {
        setError('Could not reach the server to transcribe — check your connection and try again.')
        setStatus('idle')
        onTranscriptFailed?.('Could not reach the server.')
      }
    },
    [onTranscribed, onTranscriptFailed, reset],
  )

  const start = useCallback(async () => {
    setError(null)
    if (!supported) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      // Prefer a broadly-supported, compact audio container; fall back to what
      // the browser gives us.
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find((m) =>
        MediaRecorder.isTypeSupported(m),
      ) ?? ''
      lastMimeRef.current = mime
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const mime = lastMimeRef.current || rec.mimeType || 'audio/webm'
        stopStream()
        clearTimer()
        void upload(chunksRef.current, mime)
      }
      rec.onerror = () => {
        stopStream()
        clearTimer()
        setStatus('idle')
        setError('Recording failed — try again.')
      }
      mediaRecorderRef.current = rec
      rec.start()
      setStatus('record')
      setElapsed(0)
      const startTime = Date.now()
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 250)
    } catch {
      setError('Microphone permission denied — enable it in the browser and try again.')
      setStatus('idle')
    }
  }, [supported, stopStream, clearTimer, upload])

  const stop = useCallback(() => {
    const rec = mediaRecorderRef.current
    if (rec && rec.state === 'recording') rec.stop()
  }, [])

  const cancel = useCallback(() => {
    // Abort without uploading: stop the recorder and throw away the clip.
    const rec = mediaRecorderRef.current
    try {
      if (rec && rec.state !== 'inactive') {
        rec.ondataavailable = null // don't let the buffered chunks leak to upload
        rec.onstop = null
        rec.stop()
      }
    } catch {
      /* already stopped */
    }
    stopStream()
    clearTimer()
    reset()
  }, [stopStream, clearTimer, reset])

  if (!supported) return null

  const isBusy = status === 'transcribing'

  const outer = compact ? 'h-9 w-9' : 'h-10 w-10'
  const glass = variant === 'glass'
  // Idle mic button: glass style is a translucent deep-blue pill; legacy is the
  // light white chip.
  const idleClass = glass
    ? 'border border-glass-border bg-glass text-on-surface-variant hover:bg-glass-strong hover:text-on-surface'
    : 'border border-outline-variant bg-white/60 text-on-surface-muted hover:border-outline hover:text-on-surface'

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        {status === 'idle' && (
          <button
            type="button"
            onClick={start}
            disabled={disabled || isBusy}
            aria-label="Record — click and speak"
            title="Record — click and speak"
            className={`flex shrink-0 items-center justify-center rounded-full border transition hover:border-outline hover:text-on-surface disabled:opacity-40 ${idleClass} ${outer}`}
          >
            <MicIcon />
          </button>
        )}

        {status === 'record' && (
          <>
            <span className="flex items-center gap-2 rounded-full border border-error/40 bg-error-container px-3 py-1.5 text-xs font-semibold text-error">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              {mmss(elapsed)}
            </span>
            <button
              type="button"
              onClick={stop}
              aria-label="Stop and transcribe"
              title="Stop and transcribe"
              className={`flex shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_8px_20px_-10px_rgba(61,123,255,0.6)] transition hover:opacity-90 disabled:opacity-40 ${outer}`}
            >
              <span className="h-3 w-3 rounded-sm bg-white" />
            </button>
            {glass && <span className="hidden text-xs text-on-surface-muted sm:inline">Tap to transcribe</span>}
          </>
        )}

        {status === 'transcribing' && (
          <span className="flex items-center gap-2 rounded-full border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium text-on-surface-muted">
            <span className="ghost" /> Transcribing…
          </span>
        )}

        {status === 'idle' && !glass && (
          <span className="hidden text-xs text-on-surface-muted sm:inline">or record aloud</span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}

      {/* Cancel affordance during recording only */}
      {status === 'record' && (
        <button
          type="button"
          onClick={cancel}
          className="self-start text-[11px] text-on-surface-muted underline underline-offset-2 transition hover:text-on-surface"
        >
          Cancel
        </button>
      )}
    </div>
  )
}

function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Static microphone glyph — hoisted so it isn't redefined per render. */
function MicIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 ${className}`}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </svg>
  )
}
