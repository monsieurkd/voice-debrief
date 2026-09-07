# What I Mean: Ready-to-copy prompt templates

The working loop these templates feed: **tiny slice → verify → review gate →
commit**. For code you can move fast; for UI the human (you) is the CI. One
screen per commit, eyeball a screenshot as the test, reviewer pass before merge.

Setup facts the templates rely on (already true in this repo):

- `AGENTS.md` → `CLAUDE.md` → `KNOWLEDGE_BASE.md` are auto-loaded for agents
  working here, so there is no need to repeat generalities, only deltas.
- The product is **chat-first**: the landing `/` is a ChatGPT-style chat window
  (text + voice-in via the recorder, optional voice-out via provider TTS). The
  old structured-journal + extraction layer was removed.
- Invariants: guests can **chat** immediately without login (the first turn
  mints an anonymous guest that's adopted onto an account on signup/login); the
  user's message is persisted **before** the model call, so it is never lost on
  LLM failure; server-action inputs are Zod-validated (`src/lib/action-args.ts`);
  provider errors are mapped to safe messages (`summarizeLlmError` /
  `summarizeAsrError`), never raw `e.message`; the Digital Sanctuary tokens in
  `src/app/globals.css` and primitives in `src/components/ui.tsx` are the
  locked design system.
- **Verification is non-optional.** Every prompt ends with the Verify block
  below. Never drop it. Commands: `npm run typecheck && npm run lint && npm
  test`; `npm run build` for server-component/route changes. There is no DB
  suite anymore (the schema slimmed to chat), and `npm run test:db` was dropped.
  If an agent can't run the checks (no DB for seed/migrate, no browser), it must
  say so rather than claim a pass.

```
Verify (required; no change is done until this runs):
- npm run typecheck && npm run lint && npm test
- npm run build  (if this touches server components / routes / actions)
- [UI screens:] capture + attach a screenshot of the changed screen, and state
  how it meets the "Done when" outcome.
- Report each command's actual result. If anything can't run, name why.
```

---

## A. Feature slice (the daily-commit pattern)

```
Build [small feature] on [screen]. One screen, one commit.

Follow KNOWLEDGE_BASE.md. What:
- [user-visible behavior in 2-3 sentences]
- Must keep working: guests can chat without login; the user's message is
  persisted before the model call (never lost on LLM failure); provider errors
  surface as friendly messages, never raw e.message.

Don't: touch the globals.css tokens, or gate the chat landing (/) behind auth.

Done when: [one measurable outcome].
Then run the required Verify block.
```

## B. Bugfix with repro (kills the "it just doesn't work" loop)

```
Fix [one sentence symptom] on [screen/action].

Repro: [exact steps] → [what happens now] → [expected].

Keep: errors never show raw e.message to users; action inputs stay
Zod-validated (action-args.ts).

Done when: repro no longer reproduces, and a regression test covers it if
testable. Then run the required Verify block.
```

## C. UI "feels bad" (audit-first; the one that teaches design taste)

```
The [screen] UI feels [cramped / generic / no hierarchy / hard to scan].

Keep the Digital Sanctuary tokens and ui.tsx primitives. Do not rebuild the palette.

1. Audit it against the ui-ux-pro-max skill first. Name the top 3-5 systemic
   problems (hierarchy, spacing rhythm, contrast, motion), one line each on
   *why* it matters.
2. Fix at the highest-leverage level: shared primitive/token first, then the
   screen. If the whole design language is wrong, say so in 2 sentences with
   evidence. Do not rebuild without my OK.

Reference for taste: [an app you like + the quality, e.g. "Notion's calm,
whitespace-heavy reading"].

Done when: the primary action is the loudest thing on the page, the page
reads in one glance. Then run the required Verify block. For UI, that branch
always includes capturing the screenshot.
```

Paste a screenshot of the screen into the prompt when you can. The agent is
blind otherwise, and the *feeling* ("cramped", "no focal point") is a better
instruction than the fix ("center this").

## D. Approval gate (the "rigorous testing" half)

```
Review the pending diff for [branch].
1. Run the adversarial-tester agent: attack guest paths, failed actions,
   mobile, edge inputs.
2. Run the ship-reviewer agent: does it meet the task's acceptance criteria,
   keep the invariants, stay in scope?
Report verdict + findings with file:line, fix P0/P1 findings, then run the
required Verify block to confirm the fixes are clean.
```

The agents (`feature-dev`, `adversarial-tester`, `ship-reviewer`) live in
`~/.claude/agents/`; the `ship-team` skill runs the whole pipeline in one go.
For UI work, run it through the `ui-ux` agent (`~/.claude/agents/ui-ux.md`),
which already encodes the Digital Sanctuary language and non-negotiables.
