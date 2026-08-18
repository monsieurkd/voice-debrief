import type { ExtractionPayload } from './extraction-schema'
import { todayInAppTz, isoMinusDays, parseTimestamp } from './dates'

/**
 * Demo week — five pre-baked days, one story arc, seeded instantly (no LLM).
 * Three threads weave through the days so the journal reads as *compounding*,
 * not five unrelated notes:
 *   Launch      D1 clash → D2 scope-down → D4 scope creep → D5 merged (resolves)
 *   Deep work   D3 block held → D4 skipped → D5 recommitted
 *   Migration   D3 risks surface → D5 written up for Priya
 * `runThreads` (the cross-day insight pass) exists to find exactly these —
 * and the demo week ships baked threads so that payoff is visible keyless.
 */
export interface DemoDay {
  dayOffset: number // 0 = today
  transcript: string
  payload: ExtractionPayload
  startedAt: Date
}

export function buildDemoWeek(now = new Date()): DemoDay[] {
  const today = todayInAppTz(now)
  const d = (k: number) => isoMinusDays(today, k) // date string for day-offset k
  // 19:40 in the app TZ; valid by construction (built from an ISO date), hence the assertion
  const evening = (k: number) => parseTimestamp(`${d(k)}T19:40`)!

  // startedAt is derived per day below (19:40 app-TZ), so the literals omit it
  const days: Omit<DemoDay, 'startedAt'>[] = [
    {
      dayOffset: 4,
      transcript: `Rough one. Standup went sideways — Sarah and I clashed over the launch deadline, again, and it got tense. She wanted to keep Friday; there's no way the work fits by Friday. We pushed it a week, but honestly I'm not sure that's realistic either. This launch has come up every single day this week and every time I'm more wound up about it.

What would actually help is sitting down with Sarah and scoping it properly — what's truly in versus out. If I do that tomorrow morning, the rest might unstick.`,
      payload: {
        overview:
          'Tense standup over the launch deadline — pushed a week under doubt, with frustration building day over day. One clear unblocking move: a proper scope-down with Sarah.',
        mood: 'low',
        energy: 2,
        pace: 'rushed',
        engagement: 3,
        tone: 'frustrated',
        events: [
          { what: 'Standup clash with Sarah over the launch deadline', tags: [{ kind: 'person', name: 'Sarah' }, { kind: 'project', name: 'Launch' }] },
        ],
        reflections: [
          { content: 'The launch has come up every day this week and winds me up more each time', kind: 'worry', tags: [{ kind: 'project', name: 'Launch' }] },
        ],
        decisions: [
          { summary: 'Push the launch deadline to next week', rationale: 'the work does not fit by Friday — even a week may be optimistic', resolved: true, tags: [{ kind: 'project', name: 'Launch' }] },
        ],
        next_steps: [
          // completed on day 2 — the arc must show follow-through, not a backlog
          { content: 'Scope the launch down with Sarah — truly in vs out', status: 'done', due_on: d(3), goal: 'Launch', tags: [{ kind: 'person', name: 'Sarah' }] },
        ],
      },
    },
    {
      dayOffset: 3,
      transcript: `The scope-down with Sarah actually happened this morning and it went better than I feared. We cut the migration tool from the launch entirely — it was quietly eating half the risk. What's left is genuinely shippable. I felt my shoulders drop for the first time this week.

Still tired though. The argument from yesterday kept replaying while I worked. Next time I should sleep on it before pushing back in standup.`,
      payload: {
        overview:
          'The scope-down with Sarah happened and went better than feared — the migration tool is cut, and what remains is shippable. Relief, but the week is still wearing on them.',
        mood: 'neutral',
        energy: 3,
        pace: 'measured',
        engagement: 3,
        tone: 'relieved',
        events: [
          { what: 'Scope-down session with Sarah — cut the migration tool from launch', tags: [{ kind: 'person', name: 'Sarah' }, { kind: 'project', name: 'Launch' }] },
        ],
        reflections: [
          { content: "Yesterday's argument kept replaying — should sleep on it before pushing back", kind: 'realization', tags: [] },
        ],
        decisions: [
          { summary: 'Cut the migration tool from the launch scope', rationale: 'it was quietly eating half the risk', resolved: true, tags: [{ kind: 'project', name: 'Launch' }] },
        ],
        next_steps: [
          { content: 'Write the trimmed launch checklist', status: 'open', due_on: d(1), goal: 'Launch', tags: [] },
        ],
      },
    },
    {
      dayOffset: 2,
      transcript: `Good day, weirdly good. I protected the first two hours — no Slack, no meetings — and shipped the data-model diagram I'd been carrying around as this vague anxious thing for weeks. Concrete now. That block is staying.

At lunch Priya and I finally talked through the migration plan. Nothing decided, but the cutover risks are on the table now instead of in my head. I also noticed I say yes to way too many small requests — three people asked for "quick looks" today and I gave away the afternoon to two of them.`,
      payload: {
        overview:
          'A genuinely good day: the protected 9–11 block produced the long-delayed data-model diagram, and the migration risks finally got said out loud with Priya. A pattern emerged too — too many yeses to small requests.',
        mood: 'high',
        energy: 4,
        pace: 'measured',
        engagement: 4,
        tone: 'content',
        events: [
          { what: 'Held the 9–11 deep-work block and finished the data-model diagram', tags: [{ kind: 'project', name: 'Data model' }] },
          { what: 'Migration plan talk with Priya — cutover risks surfaced, nothing decided', tags: [{ kind: 'person', name: 'Priya' }, { kind: 'project', name: 'Migration' }] },
        ],
        reflections: [
          { content: 'The diagram was an anxious vague thing until it was concrete — protected mornings work', kind: 'realization', tags: [{ kind: 'project', name: 'Data model' }] },
          { content: 'Saying yes to too many small requests — gave the afternoon to two "quick looks"', kind: 'worry', tags: [] },
        ],
        decisions: [
          { summary: 'Keep protecting 9–11 for deep work — no Slack, no meetings', resolved: true, tags: [] },
        ],
        next_steps: [
          // completed on day 5 — the story pays it off
          { content: 'Write up the migration cutover risks for Priya', status: 'done', due_on: d(0), goal: 'Migration', tags: [{ kind: 'person', name: 'Priya' }] },
        ],
      },
    },
    {
      dayOffset: 1,
      transcript: `Wobble day. The launch crept back into standup — someone promised a stakeholder the migration tool "if there's time", and I felt the old frustration rising before I caught it. I said the scope was agreed and left it there, but it sat with me all morning.

Then the day got away from me: back-to-back reviews, and I gave away the 9–11 block for a meeting that didn't need me. By afternoon I was just tired. One thing I did right — declined the extra design review for Thursday. First no in a while.`,
      payload: {
        overview:
          'A wobble: launch scope crept back in standup (met with a caught-but-fresh frustration), the deep-work block was given away to an unnecessary meeting — but also the first clear "no" in a while.',
        mood: 'low',
        energy: 2,
        pace: 'rushed',
        engagement: 3,
        tone: 'drained',
        events: [
          { what: 'Launch scope crept back in standup — migration tool re-promised "if there\'s time"', tags: [{ kind: 'project', name: 'Launch' }] },
          { what: 'Gave away the 9–11 block to a meeting that did not need them', tags: [] },
        ],
        reflections: [
          { content: 'Felt the old launch frustration rising and caught it — scope was agreed and said so', kind: 'realization', tags: [{ kind: 'project', name: 'Launch' }] },
        ],
        decisions: [
          { summary: 'Decline the extra Thursday design review — first no in a while', resolved: true, tags: [] },
        ],
        next_steps: [
          { content: 'Flag the scope creep to Sarah before it hardens', status: 'open', due_on: d(0), goal: 'Launch', tags: [{ kind: 'person', name: 'Sarah' }] },
        ],
      },
    },
    {
      dayOffset: 0,
      transcript: `Settled today, in a way that feels earned. I wrote up the migration risks for Priya in the morning block — the cutover dependency thing turned out to be one paragraph once I actually sat with it. She's relieved to have it in writing.

And the launch scope-down doc got merged. Someone even linked it in the channel when the "if there's time" thing came up again, so that thread is closed without me having to fight it. Weird feeling: the thing I was dreading all week just… resolved.

Keeping the morning block. That's the lesson of this week: mornings make the days.`,
      payload: {
        overview:
          'An earned settle: the migration risks are written up for Priya, and the launch scope-down doc got merged — the week\'s dread resolved itself through earlier decisions. The morning block is the keeper.',
        mood: 'high',
        energy: 4,
        pace: 'measured',
        engagement: 4,
        tone: 'content',
        events: [
          { what: 'Wrote up the migration cutover risks for Priya in the morning block', tags: [{ kind: 'person', name: 'Priya' }, { kind: 'project', name: 'Migration' }] },
          { what: 'Launch scope-down doc merged — ended the scope-creep debate in channel', tags: [{ kind: 'project', name: 'Launch' }] },
        ],
        reflections: [
          { content: 'The thing dreaded all week resolved through earlier decisions — mornings make the days', kind: 'realization', tags: [] },
        ],
        decisions: [
          { summary: 'Keep the 9–11 deep-work block as the standing rule', resolved: true, tags: [] },
        ],
        next_steps: [
          { content: 'Walk the launch checklist with Sarah before Thursday', status: 'open', due_on: d(-1), goal: 'Launch', tags: [{ kind: 'person', name: 'Sarah' }] },
          { content: 'Protect tomorrow morning — it is the week\'s engine', status: 'open', due_on: d(-1), tags: [] },
        ],
      },
    },
  ]

  return days.map((day): DemoDay => ({ ...day, startedAt: evening(day.dayOffset) }))
}
