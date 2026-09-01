// FT1 — Markdown export. A PURE renderer: ExtractionPayload in, GitHub-
// Flavored Markdown out. It reads no clock, no env and no React — identical
// input is byte-identical output. All model/user text is escaped so hostile
// strings can never forge structure (headings, lists, fences, raw HTML), and
// empty fields are dropped rather than rendered as stubs.

import type { ExtractionPayload, TagRef } from './extraction-schema'
import { formatDate } from './dates'
import { SECTIONS, type SectionKey } from './constants'

export interface DebriefMarkdownOptions {
  /**
   * The calendar date the H1 carries. A string is used verbatim (caller-
   * formatted); a Date is formatted in the app timezone via formatDate.
   * Nothing is inferred from "now" — without opts the title carries a fixed
   * stand-in date, keeping the renderer deterministic.
   */
  date?: string | Date
}

/** Title date when the caller passes none — deliberately fixed, not "today". */
const DEFAULT_DATE = '1970-01-01'

/** Every line separator (incl. the exotic Unicode ones — NEL, line
 *  separator, paragraph separator): a field's embedded newline must never
 *  become a line of its own, or it could forge a heading. Written as \u
 *  escapes because editors corrupt invisible literal chars (this once held
 *  U+0080/U+202F/U+200F — no-break space and RLM — instead). */
const LINE_BREAKS = /\r\n?|[\n\v\f\u0085\u2028\u2029]/g

/** Inline punctuation that could open emphasis / code spans / links / raw
 *  HTML once embedded in our line. Backslash is escaped first so real escapes
 *  can never double up or be swallowed. */
const INLINE_METACHARS = /[\\`*_[\]<]/g

/**
 * Neutralize one field of model/user text for embedding as inline content:
 * flatten to a single line, backslash-escape inline metacharacters, and
 * escape a leading character that GFM would parse as a block opener —
 * heading (#), bullet (- + *), blockquote (>), fence (~), or ordered-list
 * marker (1. / 1)). Even inside a bullet ("- # x") such an opener would
 * otherwise forge a nested block. Nullable like clean() so optional fields
 * can flow straight in — absent text escapes to ''.
 */
function escapeMarkdownText(text: string | null | undefined): string {
  const flat = (text ?? '')
    .replace(LINE_BREAKS, ' ')
    .trim()
    .replace(INLINE_METACHARS, (c) => `\\${c}`)
  if (/^[#\-+>~]/.test(flat)) return `\\${flat}`
  return flat.replace(/^(\d{1,9})([.)])/, '$1\\$2')
}

/** '' for absent/whitespace-only fields — the gate every optional field passes. */
function clean(s?: string | null): string {
  return (s ?? '').trim()
}

/** Join already-escaped fragments with ' · ', dropping empty ones. */
function meta(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join(' · ')
}

/** "person: Sarah" — kind included so every string field survives export. */
function tagLabel(t: TagRef): string {
  return `${t.kind}: ${escapeMarkdownText(t.name)}`
}

function tagLabels(tags: TagRef[] | undefined): string {
  return meta((tags ?? []).filter((t) => clean(t.name)).map(tagLabel))
}

/** One bullet, one line: optional GFM task box, escaped text, ' — ' meta tail. */
function bullet(b: { box?: ' ' | 'x'; text: string; meta: string }): string {
  const prefix = b.box ? `- [${b.box}] ` : '- '
  return b.meta ? `${prefix}${b.text} — ${b.meta}` : `${prefix}${b.text}`
}

/** The scalar fields the extraction prompt calls "how the person sounded". */
function vitalsLine(d: ExtractionPayload): string {
  return meta([
    d.mood ? `mood: ${escapeMarkdownText(d.mood)}` : '',
    d.energy != null ? `energy: ${d.energy}/5` : '',
    d.pace ? `pace: ${escapeMarkdownText(d.pace)}` : '',
    d.engagement != null ? `engagement: ${d.engagement}/5` : '',
    clean(d.tone) ? `tone: ${escapeMarkdownText(d.tone)}` : '',
  ])
}

// Per-collection bullet renderers: an item whose primary text is empty is
// dropped entirely (no stray bullets), so a collection can yield zero lines.

function eventBullets(d: ExtractionPayload): string[] {
  return (d.events ?? []).flatMap((e) => {
    const what = clean(e.what)
    if (!what) return []
    return [
      bullet({
        text: escapeMarkdownText(what),
        meta: meta([clean(e.occurred_at) ? `occurred ${escapeMarkdownText(e.occurred_at)}` : '', tagLabels(e.tags)]),
      }),
    ]
  })
}

function reflectionBullets(d: ExtractionPayload): string[] {
  return (d.reflections ?? []).flatMap((r) => {
    const content = clean(r.content)
    if (!content) return []
    return [
      bullet({
        text: escapeMarkdownText(content),
        meta: meta([clean(r.kind) ? escapeMarkdownText(r.kind) : '', tagLabels(r.tags)]),
      }),
    ]
  })
}

function decisionBullets(d: ExtractionPayload): string[] {
  return (d.decisions ?? []).flatMap((dc) => {
    const summary = clean(dc.summary)
    if (!summary) return []
    return [
      bullet({
        text: escapeMarkdownText(summary),
        meta: meta([
          clean(dc.rationale) ? `why: ${escapeMarkdownText(dc.rationale)}` : '',
          dc.resolved === false ? 'still open' : '',
          tagLabels(dc.tags),
        ]),
      }),
    ]
  })
}

function nextStepBullets(d: ExtractionPayload): string[] {
  return (d.next_steps ?? []).flatMap((ns) => {
    const content = clean(ns.content)
    if (!content) return []
    return [
      bullet({
        // GFM boxes have two states; "skipped" is neither, so it stays a
        // plain bullet and the status word carries the meaning.
        box: ns.status === 'done' ? 'x' : ns.status === 'skipped' ? undefined : ' ',
        text: escapeMarkdownText(content),
        meta: meta([
          clean(ns.status) ? escapeMarkdownText(ns.status) : '',
          clean(ns.due_on) ? `due ${escapeMarkdownText(ns.due_on)}` : '',
          clean(ns.goal) ? `goal: ${escapeMarkdownText(ns.goal)}` : '',
          tagLabels(ns.tags),
        ]),
      }),
    ]
  })
}

const BULLETS_BY_SECTION: Record<SectionKey, (d: ExtractionPayload) => string[]> = {
  events: eventBullets,
  decisions: decisionBullets,
  reflections: reflectionBullets,
  next_steps: nextStepBullets,
}

/**
 * Render a debrief payload as GitHub-Flavored Markdown: an H1 carrying the
 * date, the overview, the "how it sounded" scalars, then one section per
 * collection — titled and ordered exactly like the in-app doc (SECTIONS).
 * Sections with nothing to say are omitted, never left as bare headings.
 */
export function debriefToMarkdown(data: ExtractionPayload, opts: DebriefMarkdownOptions = {}): string {
  const date =
    typeof opts.date === 'string'
      ? opts.date
      : opts.date instanceof Date
        ? formatDate(opts.date, { year: 'numeric', month: 'long', day: 'numeric' })
        : DEFAULT_DATE

  const blocks: string[] = [`# Debrief — ${escapeMarkdownText(date)}`]

  const overview = clean(data.overview)
  if (overview) blocks.push(`## Overview\n${escapeMarkdownText(overview)}`)

  const vitals = vitalsLine(data)
  if (vitals) blocks.push(`## How it sounded\n${vitals}`)

  for (const sec of SECTIONS) {
    const items = BULLETS_BY_SECTION[sec.key](data)
    if (items.length > 0) blocks.push(`## ${sec.title}\n${items.join('\n')}`)
  }

  // Blocks are non-empty and single-\n-joined internally, so '\n\n' joins can
  // never stack into a blank-line run; the file ends with exactly one newline.
  return `${blocks.join('\n\n')}\n`
}
