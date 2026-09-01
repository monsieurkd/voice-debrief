// FT1 — acceptance tests for the pure GFM renderer (src/lib/markdown.ts).
// Criterion coverage: golden full document (1), escaping of hostile strings
// (2), empty-safety (3), determinism (4), and the required hostile inputs:
// emoji, RTL text, metacharacters, a >10k-char field (5).
//
// APP_TIMEZONE is set before any call — formatDate/appTimezone read env
// lazily at call time, and pinning the zone keeps Date-opts deterministic
// (same convention as dates.test.ts).
process.env.APP_TIMEZONE = 'Asia/Ho_Chi_Minh' // UTC+7 — east of UTC, matches dates.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { debriefToMarkdown, type DebriefMarkdownOptions } from '../src/lib/markdown'
import { buildSampleSessions } from '../src/lib/sample-sessions'
import { SECTIONS } from '../src/lib/constants'

// Fixed "now" so the samples' relative due dates are pinned (dates.test.ts
// uses the same instant).
const NOW = new Date('2026-08-18T04:00:00Z')

/** Structural invariants every render must satisfy (criteria 1–3):
 *  exactly one H1 carrying the date, only our own headings, no nested
 *  bullets, no blank-line runs, one trailing newline. */
function assertWellFormed(md: string): void {
  assert.ok(md.length > 0, 'non-empty document')
  assert.ok(!md.includes('\n\n\n'), 'no blank-line runs')
  assert.ok(md.endsWith('\n') && !md.endsWith('\n\n'), 'ends with exactly one newline')

  const lines = md.split('\n')
  const h1 = lines.filter((l) => l.startsWith('# '))
  assert.equal(h1.length, 1, 'exactly one H1')
  assert.ok(h1[0]!.startsWith('# Debrief — '), 'H1 carries the date')

  const known = new Set(['Overview', 'How it sounded', ...SECTIONS.map((s) => s.title)])
  for (const l of lines) {
    if (l.startsWith('## ')) assert.ok(known.has(l.slice(3)), `heading '${l}' is one of ours`)
    if (l.startsWith('- ')) {
      assert.ok(!l.startsWith('- - ') && !l.startsWith('- # ') && !l.startsWith('- * ') && !l.startsWith('- + '),
        `no nested list from hostile text: '${l}'`)
      if (l.startsWith('- [')) assert.match(l, /^- \[[ x]\] /, 'task box only from our own statuses')
    }
  }
}

test('full realistic debrief renders the golden GFM document (criterion 1)', () => {
  const md = debriefToMarkdown(buildSampleSessions(NOW)[0]!.payload, { date: '2026-08-19' })
  assert.equal(md, GOLDEN_SAMPLE_0)
})

test('one section per top-level collection, titled and ordered like the in-app doc', () => {
  const md = debriefToMarkdown(buildSampleSessions(NOW)[0]!.payload, { date: '2026-08-19' })
  const idx = SECTIONS.map((s) => md.indexOf(`## ${s.title}`))
  assert.ok(idx.every((i) => i > 0), 'every collection section present when it has items')
  for (let i = 1; i < idx.length; i++) {
    assert.ok(idx[i]! > idx[i - 1]!, 'sections in SECTIONS order')
  }
})

test('every non-empty string field of the payload appears in the output', () => {
  const md = debriefToMarkdown(buildSampleSessions(NOW)[0]!.payload, { date: '2026-08-19' })
  for (const needle of [
    // overview
    'Tense day — clashed with Sarah over the launch deadline and pushed it a week',
    // "how it sounded" scalars (energy/engagement are numbers, checked below)
    'mood: low',
    'pace: rushed',
    'tone: frustrated',
    // event.what + tags (kind and name both)
    'Standup went sideways — clashed with Sarah over the launch deadline',
    'person: Sarah',
    'project: Launch',
    // reflection content + kind
    'The launch keeps coming back all week and winds me up more each time',
    'worry',
    'idea',
    // decision summary + rationale
    'Push the launch deadline to next week',
    'why: the work does not fit by Friday',
    // next_step content + status + due_on + goal
    'Scope the launch down with Sarah — decide what is truly in vs out',
    'open',
    'due 2026-08-19',
    'goal: Launch',
  ]) {
    assert.ok(md.includes(needle), `output contains '${needle}'`)
  }
  assert.ok(md.includes('energy: 2/5') && md.includes('engagement: 3/5'), 'numeric scales render as /5')
  assertWellFormed(md)
})

test('schema-complete payload: every optional field incl. occurred_at, 3 tag kinds, all statuses, unresolved', () => {
  const md = debriefToMarkdown(
    {
      overview: 'Rich day.',
      events: [
        {
          what: 'Shipped the migration docs',
          occurred_at: '2026-08-19',
          tags: [
            { kind: 'person', name: 'Priya' },
            { kind: 'project', name: 'Migration' },
            { kind: 'topic', name: 'Backend' },
          ],
        },
      ],
      reflections: [{ content: 'Glad we pushed through', kind: 'gratitude', tags: [] }],
      decisions: [{ summary: 'Rewrite the cache layer', rationale: 'shaves 40ms off p95', resolved: false, tags: [] }],
      next_steps: [
        { content: 'Ship the cache rewrite', status: 'done', due_on: '2026-08-19', goal: 'Latency', tags: [] },
        { content: 'Talk to Priya', status: 'open', tags: [] },
        { content: 'Table the v2 API', status: 'skipped', tags: [] },
      ],
    },
    { date: '2026-08-19' },
  )
  assert.ok(md.includes('- Shipped the migration docs — occurred 2026-08-19 · person: Priya · project: Migration · topic: Backend'))
  assert.ok(md.includes('- Glad we pushed through — gratitude'))
  assert.ok(md.includes('- Rewrite the cache layer — why: shaves 40ms off p95 · still open'))
  assert.ok(md.includes('- [x] Ship the cache rewrite — done · due 2026-08-19 · goal: Latency'), 'done has [x]')
  assert.ok(md.includes('- [ ] Talk to Priya — open'), 'open has [ ]')
  assert.ok(md.includes('- Table the v2 API — skipped'), 'skipped keeps a plain bullet')
  assertWellFormed(md)
})

// The minimal payload every optional field empty must still render.
const MINIMAL_PAYLOAD = {
  overview: 'Quiet day.',
  mood: null,
  energy: null,
  pace: null,
  engagement: null,
  tone: null,
  events: [],
  reflections: [],
  decisions: [],
  next_steps: [],
}

test('all-empty optional fields yield a valid minimal document (criterion 3)', () => {
  const md = debriefToMarkdown(MINIMAL_PAYLOAD)
  assert.equal(md, '# Debrief — 1970-01-01\n\n## Overview\nQuiet day.\n')
  assert.ok(!md.includes('## How it sounded'), 'no empty vitals heading')
})

test('whitespace-only overview and items leave only the H1 (criterion 3)', () => {
  const md = debriefToMarkdown({
    overview: '   ',
    events: [{ what: '   ', tags: [] }],
    reflections: [{ content: '', tags: [] }],
    decisions: [{ summary: '', rationale: '', resolved: false, tags: [] }],
    next_steps: [{ content: '  ', status: 'open', tags: [] }],
  })
  assert.equal(md, '# Debrief — 1970-01-01\n')
})

test('hostile strings cannot forge structure: headings, fences, HTML, nested lists (criterion 2)', () => {
  const LONG = 'x'.repeat(12000) // >10k-char field
  const md = debriefToMarkdown(
    {
      overview: `🎉 emoji #1 ${LONG}`,
      mood: 'high',
      energy: 5,
      pace: 'detailed',
      engagement: 5,
      tone: '**bold** _italic_ <script>alert(1)</script>',
      events: [
        {
          what:
            '- first\n# forged heading\n> quote\n```js\ncode\n```\n1. numbered\n*star* _under_ [link](x) `code` ~~strike~~\nline sep end',
          occurred_at: '2026-08-19',
          tags: [
            { kind: 'person', name: '> Sarah' },
            { kind: 'topic', name: 'RTL فارسی' },
          ],
        },
      ],
      reflections: [{ content: 'plain thought', kind: 'idea', tags: [] }],
      decisions: [{ summary: 'decide now', rationale: 'because', resolved: false, tags: [] }],
      next_steps: [
        { content: 'done task', status: 'done', due_on: 'tomorrow', goal: 'goal #1', tags: [] },
        { content: 'open task', status: 'open', tags: [] },
        { content: 'skipped task', status: 'skipped', tags: [] },
      ],
    },
    { date: '2026-08-19' },
  )

  // The >10k field survives whole, flattened onto one line.
  assert.ok(md.includes(LONG), '10k-char field fully present')
  assert.equal(md.split('\n').find((l) => l.includes('🎉')), `🎉 emoji #1 ${LONG}`, 'overview stays one line')

  // Block openers are neutralized: nothing below can become a heading, fence,
  // blockquote, raw HTML, or a nested list item.
  const lines = md.split('\n')
  assert.ok(!lines.some((l) => l.startsWith('# forged heading')), 'no forged heading')
  assert.ok(!lines.some((l) => l.startsWith('> quote')), 'no forged blockquote')
  assert.ok(!lines.some((l) => l.startsWith('1. numbered')), 'no forged ordered list')
  assert.ok(!md.includes('```'), 'no code fence survives (backticks escaped)')
  // Every '<' is backslash-escaped — no raw <script> tag can reach a renderer.
  assert.ok(!/(^|[^\\])<script>/.test(md), 'no raw HTML survives (every < escaped)')
  assert.ok(md.includes('\\<script>'), 'the escaped tag text itself is preserved')
  assert.ok(!md.includes(' ') && !md.includes(' '), 'exotic line separators flattened')

  // The escaped content itself is intact, inline formatting preserved.
  assert.ok(md.includes('\\- first # forged heading > quote'), 'list opener and heading escaped on one line')
  assert.ok(md.includes('\\*star\\*') && md.includes('\\_under\\_') && md.includes('\\[link\\](x)') && md.includes('\\`code\\`'))
  assert.ok(md.includes('~~strike~~'), 'inline strikethrough allowed — structure unaffected')
  assert.ok(md.includes('1. numbered'), 'ordered marker mid-line is inert text')
  assert.ok(md.includes('\\> Sarah'), 'tag name with blockquote marker escaped')
  assert.ok(md.includes('RTL فارسی') && md.includes('🎉 emoji'), 'RTL text and emoji survive verbatim')
  assert.ok(md.includes('**bold**') === false && md.includes('\\*\\*bold\\*\\*'), 'emphasis markers escaped in vitals')

  // Exactly the six real items render as bullets; none was split or nested.
  assert.equal(lines.filter((l) => l.startsWith('- ')).length, 6)
  assertWellFormed(md)
})

test('determinism: same input, byte-identical output (criterion 4)', () => {
  const payload = buildSampleSessions(NOW)[1]!.payload
  const cases: DebriefMarkdownOptions[] = [{}, { date: '2026-08-19' }, { date: new Date('2026-08-18T23:30:00Z') }]
  for (const opts of cases) {
    assert.equal(debriefToMarkdown(payload, opts), debriefToMarkdown(payload, opts))
  }
})

/** Payload with only the required fields — for date/opts-focused tests. */
const BARE_PAYLOAD = { overview: 'x', events: [], reflections: [], decisions: [], next_steps: [] }

test('no opts uses a fixed stand-in date — never "now" (criterion 4)', () => {
  assert.ok(debriefToMarkdown(BARE_PAYLOAD).startsWith('# Debrief — 1970-01-01\n'))
})

test('Date opts format in the app timezone (label rolls over at app-TZ midnight)', () => {
  const md = debriefToMarkdown(BARE_PAYLOAD, { date: new Date('2026-08-18T23:30:00Z') })
  // 2026-08-18T23:30Z is already Aug 19 in UTC+7 — the H1 must say August 19.
  assert.ok(md.startsWith('# Debrief — August 19, 2026\n'))
})

test('date string with markdown metacharacters cannot forge a heading', () => {
  const md = debriefToMarkdown(BARE_PAYLOAD, { date: '# 2026-08-19' })
  assert.ok(md.startsWith('# Debrief — \\# 2026-08-19\n'))
  assert.equal(md.split('\n').filter((l) => l.startsWith('# ')).length, 1)
})

// Golden output for sample session 0 ("Rough standup", the spec §6 worked
// example) with a fixed date — pins byte-exact rendering of a full document.
const GOLDEN_SAMPLE_0 = `# Debrief — 2026-08-19

## Overview
Tense day — clashed with Sarah over the launch deadline and pushed it a week, though doubts remain about even that. The recurring launch stress points to one unblocking move: a proper scope-down conversation.

## How it sounded
mood: low · energy: 2/5 · pace: rushed · engagement: 3/5 · tone: frustrated

## What happened
- Standup went sideways — clashed with Sarah over the launch deadline — person: Sarah · project: Launch

## What you decided
- Push the launch deadline to next week — why: the work does not fit by Friday — though even a week may be optimistic · project: Launch

## On your mind
- The launch keeps coming back all week and winds me up more each time — worry · project: Launch
- A real scope-down with Sarah — what is truly in versus out — would unstick the rest — idea · person: Sarah · project: Launch

## Your move
- [ ] Scope the launch down with Sarah — decide what is truly in vs out — open · due 2026-08-19 · goal: Launch · person: Sarah
- [ ] Hold the scope-down session Thursday morning — open · due 2026-08-20 · goal: Launch
`
