import type { ExtractionPayload } from './extraction-schema'
import { sampleTranscripts } from './sample-transcripts'
import { todayInAppTz, isoMinusDays } from './dates'

/**
 * Pre-baked extractions for the sample transcripts — what a good strong-model
 * run produces, stored instantly with NO LLM call (demo mode). Dates are built
 * relative to today so a loaded sample always looks fresh and lands inside the
 * tomorrow-plan window. tests/sample-sessions.test.ts pins every payload to
 * the real extraction schema, so schema drift breaks CI instead of the demo.
 */
export interface SampleSession {
  id: number
  label: string
  transcript: string
  payload: ExtractionPayload
}

export function buildSampleSessions(now = new Date()): SampleSession[] {
  const today = todayInAppTz(now)
  const tomorrow = isoMinusDays(today, -1)
  const inTwoDays = isoMinusDays(today, -2)

  const payloads: ExtractionPayload[] = [
    // 0 — "Rough standup" (the spec §6 worked example)
    {
      overview:
        'Tense day — clashed with Sarah over the launch deadline and pushed it a week, though doubts remain about even that. The recurring launch stress points to one unblocking move: a proper scope-down conversation.',
      mood: 'low',
      energy: 2,
      pace: 'rushed',
      engagement: 3,
      tone: 'frustrated',
      events: [
        {
          what: 'Standup went sideways — clashed with Sarah over the launch deadline',
          tags: [
            { kind: 'person', name: 'Sarah' },
            { kind: 'project', name: 'Launch' },
          ],
        },
      ],
      reflections: [
        {
          content: 'The launch keeps coming back all week and winds me up more each time',
          kind: 'worry',
          tags: [{ kind: 'project', name: 'Launch' }],
        },
        {
          content: 'A real scope-down with Sarah — what is truly in versus out — would unstick the rest',
          kind: 'idea',
          tags: [
            { kind: 'person', name: 'Sarah' },
            { kind: 'project', name: 'Launch' },
          ],
        },
      ],
      decisions: [
        {
          summary: 'Push the launch deadline to next week',
          rationale: 'the work does not fit by Friday — though even a week may be optimistic',
          resolved: true,
          tags: [{ kind: 'project', name: 'Launch' }],
        },
      ],
      next_steps: [
        {
          content: 'Scope the launch down with Sarah — decide what is truly in vs out',
          status: 'open',
          due_on: tomorrow,
          goal: 'Launch',
          tags: [{ kind: 'person', name: 'Sarah' }],
        },
        {
          content: 'Hold the scope-down session Thursday morning',
          status: 'open',
          due_on: inTwoDays,
          goal: 'Launch',
          tags: [],
        },
      ],
    },
    // 1 — "Quiet, reflective day"
    {
      overview:
        'A calm, productive day — finished the data-model diagram that had been looming, and noticed a pattern of over-committing to small requests. Plan: protect the first two hours for deep work.',
      mood: 'high',
      energy: 4,
      pace: 'measured',
      engagement: 4,
      tone: 'content',
      events: [
        {
          what: 'Finished the data model diagram after putting it off for weeks',
          tags: [{ kind: 'project', name: 'Data model' }],
        },
      ],
      reflections: [
        {
          content: 'The diagram was a vague anxious thing until it was concrete on paper',
          kind: 'realization',
          tags: [],
        },
        {
          content: 'Saying yes to too many small team requests — a pattern, not a crisis',
          kind: 'worry',
          tags: [],
        },
      ],
      decisions: [
        {
          summary: 'Protect 9–11am for deep work — no Slack, no meetings — for the rest of the week',
          resolved: false,
          tags: [],
        },
      ],
      next_steps: [
        {
          content: 'Hold the 9–11 deep-work block tomorrow',
          status: 'open',
          due_on: tomorrow,
          tags: [],
        },
      ],
    },
    // 2 — "Scattered, lots of loose ends"
    {
      overview:
        'A scattered blur — four threads touched, none finished. The migration talk with Priya surfaced cutover risks but decided nothing. Low energy by afternoon; tomorrow belongs to one thread.',
      mood: 'neutral',
      energy: 2,
      pace: 'rushed',
      engagement: 2,
      tone: 'drained',
      events: [
        {
          what: 'Met with Priya about the migration plan — risks surfaced, nothing decided',
          tags: [
            { kind: 'person', name: 'Priya' },
            { kind: 'project', name: 'Migration' },
          ],
        },
      ],
      reflections: [
        {
          content: 'The rewrite project pulls in different directions — cannot tell if progress is real',
          kind: 'worry',
          tags: [{ kind: 'project', name: 'Rewrite' }],
        },
      ],
      decisions: [
        {
          summary: 'Pick one thread tomorrow: write up the migration risks for Priya',
          rationale: 'jumping between four things finished none of them',
          resolved: false,
          tags: [{ kind: 'project', name: 'Migration' }],
        },
      ],
      next_steps: [
        {
          content: 'Write up the migration cutover risks for Priya',
          status: 'open',
          due_on: tomorrow,
          goal: 'Migration',
          tags: [{ kind: 'person', name: 'Priya' }],
        },
      ],
    },
  ]

  return sampleTranscripts.map((s, id) => ({
    id,
    label: s.label,
    transcript: s.text,
    payload: payloads[id]!,
  }))
}
