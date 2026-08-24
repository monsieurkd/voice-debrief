// Pins the browser WebM/Opus -> WAV transcoder used to make recordings
// universally Whisper-compatible (Groq rejects raw WebM/Opus uploads).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { floatToWav } from '../src/lib/webm-to-wav'

test('floatToWav produces a valid 16-bit PCM WAV with the RIFF header', () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 0.25, -0.25])
  const blob = floatToWav(samples, 16000)

  assert.equal(blob.type, 'audio/wav')
  // 44-byte header + 2 bytes per sample.
  assert.equal(blob.size, 44 + samples.length * 2)

  return blob.arrayBuffer().then((ab) => {
    const v = new DataView(ab)
    // RIFF / WAVE fourccs
    assert.equal(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)), 'RIFF')
    assert.equal(String.fromCharCode(v.getUint8(8), v.getUint8(9), v.getUint8(10), v.getUint8(11)), 'WAVE')
    // fmt chunk: PCM=1, mono=1, sampleRate=16000, 16-bit
    assert.equal(v.getUint16(20, true), 1) // audio format PCM
    assert.equal(v.getUint16(22, true), 1) // channels mono
    assert.equal(v.getUint32(24, true), 16000) // sample rate
    assert.equal(v.getUint16(34, true), 16) // bits per sample
    // data chunk fourcc
    assert.equal(String.fromCharCode(v.getUint8(36), v.getUint8(37), v.getUint8(38), v.getUint8(39)), 'data')
  })
})

test('floatToWav clamps samples to [-1, 1] and encodes PCM correctly', () => {
  const samples = new Float32Array([-1, 0, 1, 2, -2]) // out-of-range values clamp
  const blob = floatToWav(samples)
  return blob.arrayBuffer().then((ab) => {
    const v = new DataView(ab)
    // -1 -> -32768, 0 -> 0, +1 -> +32767, clamped 2 -> +32767, clamped -2 -> -32768
    assert.equal(v.getInt16(44, true), -32768)
    assert.equal(v.getInt16(46, true), 0)
    assert.equal(v.getInt16(48, true), 32767)
    assert.equal(v.getInt16(50, true), 32767) // clamped
    assert.equal(v.getInt16(52, true), -32768) // clamped (negative)
  })
})
