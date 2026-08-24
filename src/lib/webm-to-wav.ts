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

/** Decode a recorded blob to raw PCM samples, mono, 16kHz. */
export async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  // Needs a user gesture origin once; MediaRecorder has already been started,
  // so AudioContext is allowed here.
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  try {
    const arrayBuf = await blob.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuf)
    // Downmix to mono by averaging channels, then bake to 16kHz.
    const targetRate = 16000
    const len = Math.floor(audioBuffer.length * (targetRate / audioBuffer.sampleRate))
    const samples = new Float32Array(len)
    const nCh = audioBuffer.numberOfChannels
    const ratio = audioBuffer.sampleRate / targetRate
    for (let i = 0; i < len; i++) {
      const src = Math.floor(i * ratio)
      let sum = 0
      for (let c = 0; c < nCh; c++) sum += audioBuffer.getChannelData(c)[src] ?? 0
      samples[i] = sum / nCh
    }
    return samples
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
