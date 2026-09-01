// FT1 integration check — the session-to-markdown bridge that backs the
// "export .md" button. It maps a DB-loaded session onto the GFM renderer's
// payload, so we pin the mapping: every block type lands in the right section,
// unknown tag kinds / empty tags are dropped (the schema would reject them),
// and hostile text is still escaped for structure.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sessionToMarkdown } from '../src/lib/session-markdown'
import type { LoadedSession } from '../src/lib/session'

// Deterministic timezone like the markdown tests.
process.env.APP_TIMEZONE = 'Asia/Ho_Chi_Minh'

function sampleSession(): LoadedSession {
  return {
    id: 7,
    startedAt: new Date('2026-08-19T12:00:00Z'),
    overview: 'A long day shipping the export feature.',
    mood: 'high',
    energy: 3,
    pace: 'measured',
    engagement: 4,
    tone: 'steady',
    transcript: null,
    goals: [],
    blocks: [
      {
        entityType: 'event',
        id: 1,
        text: 'Cut the markdown renderer',
        tags: [
          { kind: 'project', name: 'voice-debrief' },
          { kind: 'topic', name: 'gfm' },
        ],
        occurredAt: new Date('2026-08-19T09:00:00Z'),
      },
      {
        entityType: 'event',
        id: 2,
        text: '# Forged heading in the events text',
        tags: [],
        occurredAt: new Date('2026-08-19T10:30:00Z'),
      },
      {
        entityType: 'decision',
        id: 3,
        text: 'Ship markdown as a second export format',
        tags: [{ kind: 'project', name: 'voice-debrief' }],
        rationale: 'It is the most portable form for a day.',
        resolved: false,
      },
      {
        entityType: 'reflection',
        id: 4,
        text: 'Wondering if JSON export is used at all',
        tags: [{ kind: 'person', name: 'me' }],
        kind: 'worry',
      },
      {
        entityType: 'next_step',
        id: 5,
        text: 'Add the export buttons to the session page',
        tags: [{ kind: 'topic', name: 'ui' }],
        status: 'done',
        dueOn: '2026-08-20',
        goalTitle: 'Markdown export',
      },
      // An event with an unknown tag kind + blank name must be dropped.
      {
        entityType: 'event',
        id: 6,
        text: 'This should still render, but with no tags',
        tags: [{ kind: 'unknown', name: 'junk' }, { kind: 'project', name: '   ' }],
      },
    ],
  }
}

test('sessionToMarkdown renders every block type into its own section', () => {
  const md = sessionToMarkdown(sampleSession())
  const idx = (h: string) => md.indexOf(h)
  assert.ok(idx('## What happened') > 0, 'events section present')
  assert.ok(idx('## What you decided') > idx('## What happened'), 'decisions after events')
  assert.ok(idx('## On your mind') > idx('## What you decided'), 'reflections ordered')
  assert.ok(idx('## Your move') > idx('## On your mind'), 'next steps last')

  // Row text lands in the doc.
  assert.ok(md.includes('Cut the markdown renderer'), 'event text present')
  assert.ok(md.includes('Ship markdown as a second export format'), 'decision text present')
  assert.ok(md.includes('Wondering if JSON export is used at all'), 'reflection text present')
  assert.ok(md.includes('Add the export buttons to the session page'), 'next-step text present')

  // Per-section meta.
  assert.ok(md.includes('gfm'), 'event tag name present')
  assert.ok(md.includes('worry'), 'reflection kind present')
  assert.ok(md.includes('- [x]'), 'done next-step renders a checked task box')
})

test('hostile block text cannot forge a heading', () => {
  const md = sessionToMarkdown(sampleSession())
  const lines = md.split('\n')
  const bulletBlock = lines.find((l) => l.startsWith('- ') && l.includes('Forged heading'))
  assert.ok(bulletBlock, 'the hostile text is present as a bullet')
  assert.ok(bulletBlock!.startsWith('- \\'), 'leading # is escaped, so no heading is forged')
  assert.ok(!lines.some((l) => l.startsWith('## ') && l.includes('Forged heading')), 'no forged section heading')
})

test('unknown and blank tag kinds are dropped but the text survives', () => {
  const md = sessionToMarkdown(sampleSession())
  assert.ok(md.includes('This should still render, but with no tags'), 'text kept')
  assert.ok(!md.includes('junk'), 'unknown tag keyword not leaked into output')
  assert.ok(!md.includes('unknown:'), 'no unknown-kind tag label')
})

test('empty session yields a minimal document with the H1 date', () => {
  const s = sampleSession()
  s.overview = ''
  s.mood = null
  s.energy = null
  s.pace = null
  s.engagement = null
  s.tone = null
  s.blocks = []
  const md = sessionToMarkdown(s)
  // startedAt is Aug 19 in UTC+7 too; the renderer formats it via appTimezone.
  assert.ok(md.startsWith('# Debrief — August 19, 2026\n'), 'H1 carries the calendar date')
  assert.ok(!md.includes('## Overview'), 'no empty overview section')
  assert.ok(md.trim().endsWith('August 19, 2026'), 'minimal non-empty document')
})
