// Pins the voice/ASR slice's provider-neutral routing + error-mapping logic:
//   1. ASR falls back to the main LLM provider (base URL + key) when no
//      LLM_ASR_* is set, and overrides win when they are — so "voice works on
//      every browser" needs zero extra config against an existing provider.
//   2. ASR failures map to user-safe causes and never leak provider internals.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  asrBaseUrl,
  asrApiKey,
  summarizeAsrError,
  AsrError,
  AsrUnconfiguredError,
} from '../src/lib/asr'

// Minimal well-typed env-ish objects for the injectable helpers.
const env = (o: Record<string, string>) => ({
  LLM_BASE_URL: o.LLM_BASE_URL ?? '',
  LLM_API_KEY: o.LLM_API_KEY ?? '',
  LLM_ASR_BASE_URL: o.LLM_ASR_BASE_URL ?? '',
  LLM_ASR_API_KEY: o.LLM_ASR_API_KEY ?? '',
})

test('asrBaseUrl falls back to the main LLM base URL', () => {
  assert.equal(asrBaseUrl(env({ LLM_BASE_URL: 'https://api.openai.com/v1' })), 'https://api.openai.com/v1')
})

test('asrBaseUrl prefers an explicit LLM_ASR_BASE_URL', () => {
  assert.equal(
    asrBaseUrl(env({ LLM_BASE_URL: 'https://api.openai.com/v1', LLM_ASR_BASE_URL: 'https://asr.example.com/v1' })),
    'https://asr.example.com/v1',
  )
})

test('asrBaseUrl treats a blank explicit override as "unset"', () => {
  assert.equal(asrBaseUrl(env({ LLM_BASE_URL: 'https://api.openai.com/v1', LLM_ASR_BASE_URL: '   ' })), 'https://api.openai.com/v1')
})

test('asrApiKey falls back to the main LLM API key', () => {
  assert.equal(asrApiKey(env({ LLM_API_KEY: 'sk-main' })), 'sk-main')
})

test('asrApiKey prefers an explicit LLM_ASR_API_KEY', () => {
  assert.equal(asrApiKey(env({ LLM_API_KEY: 'sk-main', LLM_ASR_API_KEY: 'sk-asr' })), 'sk-asr')
})

test('asrApiKey is empty when nothing is configured', () => {
  assert.equal(asrApiKey(env({})), '')
})

test('summarizeAsrError maps an unconfigured error to a friendly, actionable cause', () => {
  assert.match(summarizeAsrError(new AsrUnconfiguredError()), /speech-to-text isn't configured/i)
})

test('summarizeAsrError never leaks raw provider text', () => {
  const e = new AsrError('boom')
  ;(e as AsrError & { causeText?: string }).causeText = 'connection refused to 10.0.0.5:443 with secret=s3cr3t'
  const summary = summarizeAsrError(e)
  assert.ok(!/10\.0\.0\.5|s3cr3t/.test(summary), 'raw internals must not surface')
})

test('summarizeAsrError surfaces a readable failure for empty/generic errors', () => {
  assert.ok(summarizeAsrError(new AsrError('the speech-to-text service failed to respond')).length > 0)
  assert.ok(summarizeAsrError(new Error('network error')).length > 0)
})
