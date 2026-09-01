import { debriefToMarkdown } from './markdown'
import type { ExtractionPayload, TagRef } from './extraction-schema'
import type { LoadedSession } from './session'

/**
 * Maps a DB-loaded session (LoadedSession — its flat block list) onto the
 * ExtractionPayload shape the GFM renderer in markdown.ts consumes, then
 * renders it. Kept out of the route handler so it is unit-testable in node
 * without a database (LoadedSession is a plain interface).
 */
export function sessionToPayload(s: LoadedSession): ExtractionPayload {
  return {
    overview: s.overview ?? '',
    mood: (s.mood ?? undefined) as ExtractionPayload['mood'],
    energy: s.energy ?? undefined,
    pace: (s.pace ?? undefined) as ExtractionPayload['pace'],
    engagement: s.engagement ?? undefined,
    tone: s.tone ?? undefined,
    events: s.blocks
      .filter((b) => b.entityType === 'event')
      .map((b) => ({
        what: b.text,
        ...(b.occurredAt instanceof Date
          ? { occurred_at: b.occurredAt.toISOString() }
          : b.occurredAt && { occurred_at: String(b.occurredAt) }),
        tags: toTags(b.tags),
      })),
    decisions: s.blocks
      .filter((b) => b.entityType === 'decision')
      .map((b) => ({
        summary: b.text,
        ...(b.rationale != null && { rationale: b.rationale }),
        resolved: b.resolved ?? false,
        tags: toTags(b.tags),
      })),
    reflections: s.blocks
      .filter((b) => b.entityType === 'reflection')
      .map((b) => ({
        content: b.text,
        ...(b.kind != null && { kind: b.kind as ExtractionPayload['reflections'][number]['kind'] }),
        tags: toTags(b.tags),
      })),
    next_steps: s.blocks
      .filter((b) => b.entityType === 'next_step')
      .map((b) => ({
        content: b.text,
        status: (b.status as 'open' | 'done' | 'skipped') ?? 'open',
        ...(b.dueOn != null && { due_on: b.dueOn }),
        ...(b.goalTitle != null && { goal: b.goalTitle }),
        tags: toTags(b.tags),
      })),
  }
}

/** Convenience: map + render in one call, anchoring the H1 to the session start. */
export function sessionToMarkdown(s: LoadedSession): string {
  return debriefToMarkdown(sessionToPayload(s), { date: s.startedAt })
}

function toTags(tags: { kind: string; name: string }[]): TagRef[] {
  return tags.flatMap((t) => {
    const name = t.name.trim()
    if (name === '') return []
    if (t.kind !== 'person' && t.kind !== 'project' && t.kind !== 'topic') return []
    return [{ kind: t.kind, name }] // t.kind narrowed to a valid TagRef.kind
  })
}
