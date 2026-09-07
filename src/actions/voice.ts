'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { currentUserOrGuest } from '@/lib/auth'
import { parseArgs } from '@/lib/action-args'
import { checkRateLimit } from '@/lib/rate-limit'
import { DEMO_LIMITS, RATE_WINDOW_MS } from '@/lib/constants'
import { asrConfigured, AsrUnconfiguredError, transcribeAudio, summarizeAsrError } from '@/lib/asr'

/**
 * Server-side batch STT is the only voice path, and it works in every browser
 * (there is no Web Speech dictionary on Safari/Firefox/iOS, so live dictation
 * was removed). A recorded clip arrives here as a Blob; it's transcribed
 * against LLM_ASR_* / LLM_* and the text flows straight into the existing
 * transcript pipeline (the /new composer).
 * Args are client-controlled → bounded at runtime (mime type allowlist, a hard
 * size cap that keeps the upload cheap, and the per-user rate window). Errors
 * return as `error` instead of being thrown. The client must be able to show *why* a
 * clip was refused without leaking provider internals.
 */

// Bounded MIME allowlist: the client may ONLY send these recording containers, so
// memory/bandwidth can't be gamed with arbitrary uploads.
const AUDIO_MIME = ['audio/webm', 'audio/mp4', 'audio/m4a', 'audio/mpeg', 'audio/ogg', 'audio/wav'] as const
const AUDIO_MIME_SET = new Set<string>(AUDIO_MIME)

// ~2 minutes of compressed voice, generous but bounded.
const MAX_BYTES = 8 * 1024 * 1024

export type TranscribeResult = { ok: true; text: string } | { ok: false; error: string; unusable: boolean }

export async function transcribeAudioAction(input: {
  file: File | Blob
  filename?: string
}): Promise<TranscribeResult> {
  const user = await currentUserOrGuest()

  // Billed per call (an ASR round-trip costs money), so cap both total clips and
  // total audio bytes per window so a runaway client can't rack up spend.
  if (!(await checkRateLimit(`asr:u:${user.id}`, DEMO_LIMITS.transcriptionsPerHour, RATE_WINDOW_MS))) {
    return {
      ok: false,
      error: `Live transcription is capped at ${DEMO_LIMITS.transcriptionsPerHour}/hour. Type this one, or come back in a bit.`,
      unusable: false,
    }
  }

  // Check the environment up front. The client should not upload a clip that cannot be
  // processed (the record button hides itself when this is false, but re-check
  // server-side: proxies can't be trusted).
  if (!asrConfigured()) {
    return { ok: false, error: new AsrUnconfiguredError().message, unusable: true }
  }

  const parsed = parseArgs(
    z.object({ filename: z.string().trim().min(1).max(160).optional() }),
    { filename: input.filename },
    'transcribeAudio',
  )
  const file: File | Blob = input.file
  const mime = file.type || ''
  const bytes = file.size
  if (!AUDIO_MIME_SET.has(mime)) {
    return {
      ok: false,
      error: `Unsupported audio format (${mime || 'unknown'}). Record with the in-app mic instead.`,
      unusable: true,
    }
  }
  if (!bytes || bytes > MAX_BYTES) {
    return { ok: false, error: 'That recording is too long or empty. Keep clips under a couple of minutes, or try again.', unusable: true }
  }

  const filename = parsed?.filename && parsed.filename.endsWith('.webm') ? parsed.filename : `recording.${webmExt(mime)}`

  try {
    const text = await transcribeAudio(file, filename)
    if (!text) return { ok: false, error: 'Nothing could be heard. Try again in a quieter spot.', unusable: false }
    return { ok: true, text }
  } catch (e) {
    console.error('[transcribeAudioAction] error:', e)
    return { ok: false, error: summarizeAsrError(e), unusable: e instanceof AsrUnconfiguredError }
  } finally {
    // No data changed here (raw text goes straight to the composer), but keep
    // the invariant that nothing stale sticks around.
    revalidatePath('/')
  }
}

function webmExt(mime: string): string {
  if (mime === 'audio/mp4' || mime === 'audio/m4a') return 'm4a'
  if (mime === 'audio/mpeg') return 'mp3'
  if (mime === 'audio/ogg') return 'ogg'
  if (mime === 'audio/wav') return 'wav'
  return 'webm'
}
