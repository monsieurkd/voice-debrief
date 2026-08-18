// Pins the retry semantics the 2026-08 review found broken:
//   1. transport errors (the transient class) got ZERO retries while schema
//      errors got 3 — inverted robustness
//   2. truncated thinking-model output (finish_reason === 'length') was retried
//      at the SAME budget, truncating identically 3× then failing
//   3. the retry loop mutated the caller's messages array
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import type OpenAI from 'openai'
import { callJsonValidated, LlmCallError, LlmTruncatedError } from '../src/lib/llm-call'

const schema = z.object({ answer: z.string() })
const goodJson = JSON.stringify({ answer: 'ok' })
const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: 'user', content: 'q' }]

const base = {
  messages,
  schema,
  model: 'test-model',
  maxTokens: 100,
  retryDelayMs: 0, // no waiting in tests
}

test('transport errors are retried with backoff and then succeed', async () => {
  let calls = 0
  const out = await callJsonValidated({
    ...base,
    complete: async () => {
      calls++
      if (calls < 3) throw new Error('ECONNRESET')
      return goodJson
    },
  })
  assert.equal(out.answer, 'ok')
  assert.equal(calls, 3) // 2 failures absorbed + 1 success
})

test('transport errors stop after transportAttempts and surface an LlmCallError', async () => {
  let calls = 0
  await assert.rejects(
    callJsonValidated({
      ...base,
      complete: async () => {
        calls++
        throw new Error('429 rate limited')
      },
    }),
    (e: unknown) => {
      assert.ok(e instanceof LlmCallError)
      assert.match(e.message, /after 3 attempts/)
      return true
    },
  )
  assert.equal(calls, 3)
})

test('truncated output escalates the token budget once, then succeeds', async () => {
  const budgets: number[] = []
  let calls = 0
  const out = await callJsonValidated({
    ...base,
    maxTokens: 8000,
    complete: async (_msgs, { maxTokens }) => {
      budgets.push(maxTokens)
      calls++
      if (calls === 1) throw new LlmTruncatedError('hit the 8000-token budget')
      return goodJson
    },
  })
  assert.equal(out.answer, 'ok')
  assert.deepEqual(budgets, [8000, 16000]) // budget doubled, not retried blind
})

test('truncation twice fails loudly instead of looping', async () => {
  await assert.rejects(
    callJsonValidated({
      ...base,
      complete: async (_msgs, { maxTokens }) => {
        throw new LlmTruncatedError(`hit the ${maxTokens}-token budget`)
      },
    }),
    (e: unknown) => {
      assert.ok(e instanceof LlmCallError)
      assert.match(e.message, /truncated even at 200 tokens/)
      return true
    },
  )
})

test('schema failures still retry with error feedback', async () => {
  let calls = 0
  const out = await callJsonValidated({
    ...base,
    complete: async () => {
      calls++
      if (calls === 1) return '{ "wrong": true }'
      return goodJson
    },
  })
  assert.equal(out.answer, 'ok')
  assert.equal(calls, 2)
})

test('the caller’s messages array is never mutated', async () => {
  const template: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: 'user', content: 'q' }]
  let calls = 0
  await callJsonValidated({
    ...base,
    messages: template,
    complete: async () => {
      calls++
      if (calls === 1) return 'not json'
      return goodJson
    },
  })
  assert.equal(template.length, 1) // retry feedback went to the copy, not the template
})
