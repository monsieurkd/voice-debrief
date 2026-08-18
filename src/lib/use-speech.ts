'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

// Minimal declarations for the Web Speech API (not in TS's lib.dom as of 5.x).
interface SpeechAlternativeLike {
  transcript: string
}
interface SpeechResultLike {
  0: SpeechAlternativeLike
  isFinal: boolean
}
interface SpeechEventLike {
  resultIndex: number
  results: { length: number; [index: number]: SpeechResultLike }
}
interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => RecognitionLike

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const emptySubscribe = () => () => {}

/**
 * Live browser dictation (Web Speech API — free, no backend, Chrome/Edge).
 * Final phrases are appended via `onFinal`; interim words are exposed for a
 * ghost preview. Auto-restarts on silence so long monologues flow; a denied
 * microphone stops cleanly with a readable error. Returns `supported: false`
 * where the API is absent, so the mic button can hide itself.
 */
export function useSpeechDictation(onFinal: (chunk: string) => void) {
  // SSR-safe feature detection (server snapshot: unsupported; no hydration mismatch)
  const supported = useSyncExternalStore(
    emptySubscribe,
    () => !!getRecognitionCtor(),
    () => false,
  )
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<RecognitionLike | null>(null)
  const wantRef = useRef(false) // user intent — survives auto-restarts
  const onFinalRef = useRef(onFinal)
  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  useEffect(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return

    const rec = new Ctor()
    rec.lang = navigator.language || 'en-US'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let ghost = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (!r) continue
        const t = r[0].transcript
        if (r.isFinal) {
          const chunk = t.trim()
          if (chunk) onFinalRef.current(chunk)
        } else {
          ghost += t
        }
      }
      setInterim(ghost)
    }
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantRef.current = false
        setListening(false)
        setError('Microphone permission denied — enable it in the browser and try again.')
        return
      }
      setError('Dictation hiccup — click the mic again.')
    }
    rec.onend = () => {
      setInterim('')
      if (wantRef.current) {
        try {
          rec.start() // Chrome ends the session after silence; keep going
        } catch {
          /* already starting */
        }
      } else {
        setListening(false)
      }
    }
    recRef.current = rec
    return () => {
      wantRef.current = false
      try {
        rec.abort()
      } catch {
        /* already stopped */
      }
      recRef.current = null
    }
  }, [])

  const toggle = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    setError(null)
    if (wantRef.current) {
      wantRef.current = false
      setListening(false)
      try {
        rec.stop()
      } catch {
        /* already stopped */
      }
    } else {
      wantRef.current = true
      setListening(true)
      try {
        rec.start()
      } catch {
        /* already started */
      }
    }
  }, [])

  return { supported, listening, interim, error, toggle }
}
