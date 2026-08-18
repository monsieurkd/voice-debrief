// Deterministic self-test for the extraction layer — NO API key or network needed.
// Exercises: safeJsonParse (fence stripping), Zod accept/reject, and the retry loop
// (via an injected scripted completer that returns bad-then-good output, then always-bad).
import { extractDebrief, ExtractionError } from '../src/lib/extract'
import { safeJsonParse } from '../src/lib/json'
import { extractionPayload } from '../src/lib/extraction-schema'
import type OpenAI from 'openai'

let pass = 0
let fail = 0
function assert(cond: unknown, msg: string) {
  if (cond) {
    pass++
    console.log('  ✓', msg)
  } else {
    fail++
    console.error('  ✗', msg)
  }
}

async function main() {
  // 1. safeJsonParse strips ```json fences
  const fenced = safeJsonParse('```json\n{"overview":"hi","events":[]}\n```') as { overview: string }
  assert(fenced.overview === 'hi', 'safeJsonParse strips ```json fences and parses')

  // 2. Zod accepts a well-formed payload
  const good = extractionPayload.safeParse({
    overview: 'Good day.',
    events: [{ what: 'Met Sarah', tags: [] }],
    reflections: [],
    decisions: [{ summary: 'Ship Friday', resolved: true }],
    next_steps: [],
  })
  assert(good.success, 'Zod accepts a well-formed payload')

  // 3. Zod rejects an empty overview (min length)
  const bad = extractionPayload.safeParse({ overview: '', events: [] })
  assert(!bad.success, 'Zod rejects an empty overview')

  // 4. Retry loop: completer returns non-JSON, then a payload with a bad reflection
  //    (missing required `content`), then a valid payload. Expect success on attempt 3.
  const validJson = JSON.stringify({
    overview: 'Rough day.',
    mood: 'low',
    energy: 2,
    events: [{ what: 'Standup went sideways', tags: [{ kind: 'person', name: 'Sarah' }] }],
    reflections: [{ content: 'Not sure the deadline is realistic', kind: 'worry' }],
    decisions: [{ summary: 'Push the deadline to next week', rationale: 'not realistic', resolved: true }],
    next_steps: [{ content: 'Scope the deadline down with Sarah', status: 'open', goal: 'Launch' }],
  })
  let step = 0
  const calls: string[] = []
  const scripted = async (_msgs: OpenAI.Chat.ChatCompletionMessageParam[]): Promise<string> => {
    calls.push('call')
    step++
    if (step === 1) return 'not json at all'
    if (step === 2) return '{ "overview": "ok", "events": [], "reflections": [ { "kind": "worry" } ] }' // reflection missing content
    return validJson
  }
  const out = await extractDebrief('dummy transcript', { complete: scripted })
  assert(out.overview === 'Rough day.', 'retry loop returns the valid payload after 2 bad attempts')
  assert(calls.length === 3, `completer called 3× (initial + 2 retries) — got ${calls.length}`)
  assert(out.next_steps[0].goal === 'Launch', 'goal carried as a title string (not an id)')

  // 5. Always-bad completer → ExtractionError after exhausting retries
  try {
    await extractDebrief('x', { complete: async () => 'garbage every time' })
    assert(false, 'always-bad output should have thrown')
  } catch (e) {
    assert(e instanceof ExtractionError, 'always-bad output throws ExtractionError')
  }

  console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
