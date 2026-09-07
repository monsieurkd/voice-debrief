#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ui-judge.mjs — score the captured screenshots with a VISION LLM against the
// design rubric in docs/ui-rubric.md.
//
//   npm run ui:judge                       # judge every shot in .ui-shots/
//   npm run ui:judge -- --filter=home      # judge one screen
//   npm run ui:judge -- --fail-on-high     # exit 1 if any [high] issue / <6/10
//
// Config (from .env.local — see .env.example):
//   LLM_VISION_API_KEY   required
//   LLM_VISION_BASE_URL  default https://api.deepseek.com/v1
//   LLM_VISION_MODEL     default deepseek-v4-flash-vision-exp
//     └ DeepSeek: this experimental model id is the ONLY one that accepts
//       images; deepseek-v4-flash / deepseek-v4-pro return 400 for image input.
//
// Reads .ui-shots/manifest.json (written by npm run ui:shots). Writes
// .ui-shots/ui-qa-report.md. Exit 2 = config error, 1 = judge/API failure.
// ─────────────────────────────────────────────────────────────────────────────
import dotenv from 'dotenv'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env.local') })

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, '.ui-shots')
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json')
const RUBRIC_PATH = path.join(ROOT, 'docs', 'ui-rubric.md')
const REPORT_PATH = path.join(OUT_DIR, 'ui-qa-report.md')

const API_KEY = process.env.LLM_VISION_API_KEY
const BASE_URL = (process.env.LLM_VISION_BASE_URL ?? 'https://api.deepseek.com/v1').replace(/\/$/, '')
const MODEL = process.env.LLM_VISION_MODEL ?? 'deepseek-v4-flash-vision-exp'

// One-line context per screen — the judge needs to know what each page IS to
// judge whether its primary action is obvious. Keep in sync with ui-shots.mjs.
const SCREEN_GUIDE = {
  home: 'Voyo\'s product landing — it IS the chat app. A visitor lands here without logging in. The "What is Voyo?" greeting card, the message composer ("Write or speak your day…") and the send + mic buttons are the whole screen on mobile; on desktop there is also a past-conversation sidebar ("New voice chat", "Voice" personas, "Journal").',
  login: 'The login page: wordmark, a short line of copy, one card with the sign-in form, and a "Create an account" link beneath.',
  signup: 'The signup page: wordmark, a short line of copy, one card with the account-creation form, and a "Log in" link beneath.',
  notfound: 'The 404 page: "That page isn\'t here", one sentence of copy, and two actions ("Back to Home" primary pill + a text link).',
}

const SYSTEM = `You are a strict senior product UI reviewer. You grade a screenshot of
the "Voyo" app (a private voice-first journal/chat) against a written rubric.
The app has a locked design system: semantic color tokens (surface / on-surface
/ on-surface-muted / primary / primary-container / outline-variant …) defined
in src/app/globals.css and shared primitives in src/components/ui.tsx
(Button, Card, Field, Wordmark, GhostLoader). The canvas is a flat light grey,
white panes with hairline borders, one restrained blue accent, one radius
family, a 4px spacing rhythm and a small fixed elevation scale.

Rules of the job:
1. Judge ONLY what is visible in the static screenshot. Do not infer
   interactivity, animation quality or hover states. If the page looks broken
   (blank, unstyled, overlapping, a visible error/crash message, horizontal
   scroll on mobile), score it 1/10 and say exactly what is broken.
2. Fixes must be token-level, never raw invented values: name the token to use
   (e.g. "replace the raw #123456 with a surface/outline token from globals.css")
   or the ui.tsx primitive to swap in. Do NOT propose an app redesign.
3. Be concrete and specific to this screenshot. Generic advice ("improve the
   layout") is a failed answer; name the element, the spacing, the colour.
4. Severity: [high] = breaks the page or the product promise (unreadable text,
   off-token colour, no obvious action, overflow). [med] = noticeably off
   (inconsistent rhythm, weak hierarchy, slightly low contrast). [low] =
   polish (a nudge on spacing/weight). You may return zero issues.
5. Output EXACTLY this shape, nothing before or after:
   **Overall: <n>/10**
   ## Issues
   - [severity] <what is wrong and where, 1-2 sentences>
   ## Top fix
   <exactly one concrete, token-level fix that moves the score most>`

function fail(code, message) {
  console.error(`ui-judge: ${message}`)
  process.exit(code)
}

function parseFilter() {
  const flag = process.argv.indexOf('--filter')
  if (flag === -1) return null
  const value = process.argv[flag + 1]
  return value ? new Set(value.split(',').map((s) => s.trim()).filter(Boolean)) : null
}

async function judge(shot, rubric) {
  const filePath = path.join(OUT_DIR, shot.file)
  const imageB64 = readFileSync(filePath).toString('base64')
  const guide = SCREEN_GUIDE[shot.name] ?? `A page at ${shot.path}.`
  const width = `${shot.width}px viewport (${shot.width < 600 ? 'mobile' : 'desktop'})`

  const payload = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Rubric:\n${rubric}\n\nScreen: ${guide}\nViewport: ${width}\n\nGrade this screenshot now.` },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageB64}` } },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 1400,
    // Disable chain-of-thought. DeepSeek's thinking models count reasoning
    // tokens against max_tokens and burn the whole budget reasoning over the
    // long system prompt + rubric, returning content="" (finish_reason=length).
    thinking: { type: 'disabled' },
  }

  let lastError = ''
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120_000),
      })
      if (!res.ok) {
        lastError = `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, attempt * 3_000))
          continue
        }
        break
      }
      const data = await res.json()
      const verdict = data.choices?.[0]?.message?.content?.trim()
      if (!verdict) {
        lastError = 'empty completion (choices[0].message.content missing)'
        continue
      }
      return verdict
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      await new Promise((r) => setTimeout(r, attempt * 2_000))
    }
  }
  throw new Error(`judge API failed after 2 attempts: ${lastError}`)
}

function summarize(verdict) {
  const score = Number(/Overall:\s*(\d+)\s*\/\s*10/i.exec(verdict)?.[1])
  const count = (re) => (verdict.match(re) ?? []).length
  return {
    score: Number.isFinite(score) ? score : null,
    high: count(/\[high\]/gi),
    med: count(/\[med\]/gi),
    low: count(/\[low\]/gi),
  }
}

async function main() {
  if (!API_KEY) {
    fail(
      2,
      `LLM_VISION_API_KEY is not set.\n  Add it to .env.local (see .env.example) — e.g. a DeepSeek key for the\n  ${MODEL} vision model. Any OpenAI-compatible vision endpoint works.`,
    )
  }
  if (!existsSync(MANIFEST_PATH)) {
    fail(2, `no ${path.relative(ROOT, MANIFEST_PATH)} — run "npm run ui:shots" first (needs the dev server on).`)
  }
  const rubric = existsSync(RUBRIC_PATH) ? readFileSync(RUBRIC_PATH, 'utf8') : '(rubric file missing — judge on general product-UI quality)'
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const filter = parseFilter()
  const shots = manifest.filter((s) => !filter || filter.has(s.name))
  if (shots.length === 0) {
    fail(2, `--filter matched nothing in the manifest (${manifest.length} shot(s) available).`)
  }

  console.log(`Judging ${shots.length} shot(s) with ${MODEL}…`)
  const rows = []
  const blocks = []
  for (const shot of shots) {
    process.stdout.write(`  ${shot.file} … `)
    try {
      const verdict = await judge(shot, rubric)
      const s = summarize(verdict)
      rows.push({ ...shot, ...s })
      blocks.push({ shot, verdict, ...s })
      console.log(`score ${s.score ?? '?'}/10, ${s.high} high / ${s.med} med / ${s.low} low`)
    } catch (err) {
      rows.push({ ...shot, score: null, error: err.message })
      console.error(`FAILED: ${err.message}`)
    }
  }

  const md = [
    `# UI QA report — ${new Date().toISOString()}`,
    '',
    `Judge: ${MODEL} — rubric: docs/ui-rubric.md`,
    '',
    '| Screen | Viewport | Score | high | med | low |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) =>
      r.error
        ? `| ${r.name} | ${r.width}px | **error** | — | — | — |\n  \`${r.error}\``
        : `| ${r.name} | ${r.width}px | ${r.score ?? '?'}/10 | ${r.high} | ${r.med} | ${r.low} |`,
    ),
    '',
    '---',
    '',
    ...blocks.flatMap(({ shot, verdict }) => [
      `## ${shot.name} — ${shot.width}px`,
      '',
      verdict,
      '',
    ]),
  ]
  writeFileSync(REPORT_PATH, md.join('\n'))
  console.log(`\nReport → ${path.relative(ROOT, REPORT_PATH)}`)

  const failOnHigh = process.argv.includes('--fail-on-high')
  const errors = rows.filter((r) => r.error)
  const highs = rows.filter((r) => !r.error && (r.high > 0 || (r.score ?? 0) < 6))
  if (errors.length > 0) {
    console.error(`ui-judge: ${errors.length} shot(s) could not be judged (see report).`)
    process.exit(1)
  }
  if (failOnHigh && highs.length > 0) {
    console.error(`ui-judge: --fail-on-high — ${highs.length} shot(s) have [high] issues or score <6/10.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('ui-judge:', err)
  process.exit(1)
})
