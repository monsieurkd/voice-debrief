/**
 * Client-side WebM/Opus → WAV transcoder.
 *
 * The browser's MediaRecorder produces compressed containers (e.g.
 * `audio/webm;codecs=opus`, or `audio/mp4` on Safari). Groq (and several other
 * Whisper endpoints) reject WebM/Opus, so before upload we decode the recorded
 * clip to an AudioBuffer and re-encode it as 16-bit PCM WAV — a container every
 * Whisper-compatible endpoint accepts.
 *
 * Pure browser API (AudioContext + OfflineAudioContext); no deps.
 */

/**
 * Decode `blob` to raw PCM samples, mono, 16kHz.
 *
 * The naive approach ("grab every Nth sample") aliases high frequencies into
 * the speech band and, when the mic captured the same voice on two channels
 * out of phase, sample-by-sample channel averaging phase-cancels the speech —
 * both leave only a stray syllable (e.g. "you"). We avoid both:
 *
 * 1. Mix to mono FIRST, using the browser's own channel mixdown (a power-equal
 *    sum that downweights out-of-phase content instead of cancelling it).
 * 2. Resample 44.1/48k → 16k with an OfflineAudioContext, whose resampler is
 *    band-limited (no naive per-16th-sample decimation).
 *
 * Both steps are pure Web Audio API; no deps.
 */
export async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()

  const OfflineCtx = window.OfflineAudioContext

  try {
    const arrayBuf = await blob.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuf)

    const targetRate = 16000
    const len = Math.round(audioBuffer.length * (targetRate / audioBuffer.sampleRate))

    // --- Phase 1: native mono downmix + band-limited resample to 16k. ---
    if (typeof OfflineCtx === 'undefined' || typeof OfflineCtx !== 'function') {
      // Very old browser without OfflineAudioContext: fall back to a plain
      // average (better than nothing; the common path uses OfflineAudioContext).
      const out = new Float32Array(len)
      const nCh = audioBuffer.numberOfChannels
      for (let i = 0; i < len; i++) {
        const src = Math.min(audioBuffer.length - 1, Math.floor((i / len) * audioBuffer.length))
        let sum = 0
        for (let c = 0; c < nCh; c++) sum += audioBuffer.getChannelData(c)[src] ?? 0
        out[i] = sum / nCh
      }
      return out
    }

    // OfflineAudioContext with numberOfChannels=1 already performs the
    // spec-defined channel downmix (audio channels are power-equal summed into
    // the single channel; out-of-phase content is attenuated, not cancelled),
    // and its built-in resampler is band-limited. Connecting a mono-named
    // source routes the decoded (multi-channel) buffer into that 1-channel
    // render output.
    const offline = new OfflineCtx(1, len, targetRate)
    const src = offline.createBufferSource()
    src.buffer = audioBuffer
    src.connect(offline.destination)
    src.start(0)
    const rendered = await offline.startRendering()
    return rendered.getChannelData(0)
  } finally {
    void ctx.close()
  }
}


/** Encode mono float samples ([-1,1]) as a 16-bit PCM WAV blob. */
export function floatToWav(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  // RIFF header
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeAscii(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([view], { type: 'audio/wav' })
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
}
