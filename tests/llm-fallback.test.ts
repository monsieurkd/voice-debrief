import { test } from 'node:test'
import assert from 'node:assert/strict'
import type OpenAI from 'openai'
import {
  completeWithFallback,
  isTransientError,
} from '../src/lib/llm-fallback'

const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: 'user', content: 'hi' }]

// Minimal fake clients shaped like the OpenAI SDK surface we call.
type FakeClient = {
  chat: { completions: { create: (body: { model: string }) => Promise<unknown> } }
}

const result = { choices: [{ message: { content: 'ok' } }] }
const boom429 = async () => {
  const err = new Error('429 rate limited')
  ;(err as { status?: number }).status = 429
  throw err
}
const boomTimeout = async () => {
  throw new Error('request timed out after 30000ms')
}
const boomAuth = async () => {
  const err = new Error('401 invalid api key')
  ;(err as { status?: number }).status = 401
  throw err
}

// Build deps with a pinned fallback model so tests are independent of any
// LLM_FALLBACK_SMALL_MODEL set in the local environment.
const deps = (p: FakeClient, f: FakeClient | null, fallbackModel = 'glm-4.5-air') => ({
  primary: p as never,
  fallback: f as never,
  fallbackModel,
})

test('isTransientError classifies 429 and timeout/connection as transient', () => {
  const t429 = new Error('too many requests')
  ;(t429 as { status?: number }).status = 429
  assert.equal(isTransientError(t429), true)
  assert.equal(isTransientError(new Error('socket hang up')), true)
  assert.equal(isTransientError(new Error('ECONNRESET')), true)
  assert.equal(isTransientError(new Error('request timed out')), true)
  // Auth / malformed / other non-transient classes must NOT trip failover.
  const t401 = new Error('bad key')
  ;(t401 as { status?: number }).status = 401
  assert.equal(isTransientError(t401), false)
  assert.equal(isTransientError(new Error('validation mismatch')), false)
})

test('no fallback configured → primary error is rethrown untouched', async () => {
  const noFallback: FakeClient = { chat: { completions: { create: boom429 } } }
  await assert.rejects(
    completeWithFallback({ messages, model: 'm', deps: deps(noFallback, null) }),
    /429 rate limited/,
  )
})

test('transient primary failure falls back to the fallback provider', async () => {
  let usedModel = ''
  const fallback: FakeClient = {
    chat: { completions: { create: async (body) => { usedModel = body.model; return result } } },
  }
  const failingPrimary: FakeClient = { chat: { completions: { create: boom429 } } }
  const out = await completeWithFallback({
    messages,
    model: 'glm-4.5-air',
    deps: deps(failingPrimary, fallback),
  })
  assert.equal(out.choices[0].message.content, 'ok')
  // Default fallback model = the pinned primary model (glm-4.5-air).
  assert.equal(usedModel, 'glm-4.5-air')
})

test('non-transient primary failure does NOT fall back (auth/config errors propagate)', async () => {
  let fallbackCalled = false
  const fallback: FakeClient = {
    chat: { completions: { create: async () => { fallbackCalled = true; return result } } },
  }
  const authPrimary: FakeClient = { chat: { completions: { create: boomAuth } } }
  await assert.rejects(
    completeWithFallback({ messages, model: 'm', deps: deps(authPrimary, fallback) }),
    /401/,
  )
  assert.equal(fallbackCalled, false)
})

test('fallbackModelOverride lets the fallback use a different model', async () => {
  let usedModel = ''
  const fallback: FakeClient = {
    chat: { completions: { create: async (body) => { usedModel = body.model; return result } } },
  }
  const failingPrimary: FakeClient = { chat: { completions: { create: boomTimeout } } }
  await completeWithFallback({
    messages,
    model: 'glm-4.5-air',
    fallbackModelOverride: 'gemini-3.1-flash-lite',
    // No pinned deps fallbackModel — let the override resolve.
    deps: { primary: failingPrimary as never, fallback: fallback as never },
  })
  assert.equal(usedModel, 'gemini-3.1-flash-lite')
})

test('a fallback that also fails surfaces the fallback error', async () => {
  const failingPrimary: FakeClient = { chat: { completions: { create: boom429 } } }
  const failingFallback: FakeClient = { chat: { completions: { create: boomTimeout } } }
  await assert.rejects(
    completeWithFallback({ messages, model: 'm', deps: deps(failingPrimary, failingFallback) }),
    /timed out/,
  )
})
