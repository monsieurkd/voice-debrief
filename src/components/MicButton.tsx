'use client'

import { useSpeechDictation } from '@/lib/use-speech'

/**
 * The mic button — live dictation via the browser's Web Speech API. Final
 * phrases append through `onFinal` (wired to the caller's state); interim
 * words show as a ghost preview next to the button. Renders nothing where
 * the API is unsupported.
 */
export function MicButton({
  onFinal,
  disabled,
  compact,
}: {
  onFinal: (chunk: string) => void
  disabled?: boolean
  compact?: boolean
}) {
  const { supported, listening, interim, error, toggle } = useSpeechDictation(onFinal)
  if (!supported) return null

  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? 'Stop dictation' : 'Dictate — click and speak'}
        title={listening ? 'Stop dictation' : 'Dictate — click and speak'}
        className={`flex shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40 ${
          listening
            ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
            : 'border-zinc-300 text-zinc-500 hover:border-zinc-500 hover:text-zinc-800 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-300 dark:hover:text-zinc-100'
        } ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}
      >
        {listening ? (
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <path d="M12 19v3" />
          </svg>
        )}
      </button>
      {listening && interim && (
        <span className="min-w-0 truncate text-xs italic text-zinc-400 dark:text-zinc-500" aria-hidden>
          {interim}
        </span>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
