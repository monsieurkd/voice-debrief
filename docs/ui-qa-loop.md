# Voyo — the UI quality loop (`ui:shots` → `ui:judge` → fix → repeat)

The problem this solves: backend features get tests and CI; UI gets "vibes".
This repo now has the frontend equivalent — a repeatable, measurable loop you
run on every UI change, exactly like a test suite:

```
app running  →  npm run ui:shots   (Playwright screenshots the key screens)
             →  npm run ui:judge   (a vision LLM scores them against docs/ui-rubric.md)
             →  fix the [high] issues against the tokens → re-run until clean
```

The rubric is the contract, the judge is the CI, and **the tokens in
`src/app/globals.css` are the anchor** that keeps the loop converging instead
of drifting (the judge may never suggest a new palette).

## Prerequisites (one-time)

1. **Dev server** — `npm run dev` in a terminal (the script screenshots
   `http://localhost:3000` by default; override with `UI_BASE_URL`).
2. **Chrome** — already installed on this machine; the script launches system
   Chrome via `playwright-core` (no browser download). If your Chrome lives
   elsewhere: `CHROME_PATH=/path/to/chrome npm run ui:shots`.
3. **A vision API key** in `.env.local` (copy the block from `.env.example`):

   ```
   LLM_VISION_API_KEY=sk-…
   LLM_VISION_BASE_URL=https://api.deepseek.com/v1
   LLM_VISION_MODEL=deepseek-v4-flash-vision-exp
   ```

   **DeepSeek note:** `deepseek-v4-flash-vision-exp` is DeepSeek's
   *experimental vision model* — it is the **only** DeepSeek model id that
   accepts images. Sending a screenshot to `deepseek-v4-flash` or
   `deepseek-v4-pro` returns HTTP 400 "model does not support images".
   It is OpenAI-compatible, so the same three env vars also work with any
   other vision provider (e.g. a GLM-4V or Gemini OpenAI-compatible endpoint)
   — only the values change.

## Run the loop

```bash
npm run dev                        # terminal 1
npm run ui:shots                   # terminal 2 — captures .ui-shots/*.png
npm run ui:judge                   # scores them → .ui-shots/ui-qa-report.md
```

Covered screens (each at desktop 1280px and mobile 390px):
`home` (`/` — the chat product), `login`, `signup`, `notfound`. The report
gives each shot a `/10` plus concrete `[high]/[med]/[low]` findings with
token-level fixes.

Useful variants:

```bash
npm run ui:shots -- --filter=home      # capture one screen
npm run ui:judge  -- --filter=home     # judge one screen
npm run ui:judge  -- --fail-on-high    # exit 1 if any [high] or <6/10 → CI gate
```

## The discipline (this is where the value is)

1. **Fix `[high]` only.** High = broken, off-token, unreadable, no obvious
   action. Do those, then re-run. Ignore `[med]/[low]` until highs are gone.
2. **Fix against the system.** Change a class to use the right
   `globals.css` token or `ui.tsx` primitive — never "make it look nicer".
   If you catch yourself inventing a hex code or an odd padding, that's the
   bug.
3. **Converge, don't drift.** Re-run `ui:judge` after fixing. A good screen
   sits at 7+. The moment a run suggests a redesign, reject it: your job is
   consistency, the judge's job is catching inconsistency.
4. **Treat the report as a diff.** `ui-qa-report.md` overwrites each run;
   compare runs to see whether a change moved a screen up or down.
5. **Run it before you call a UI change done**, not after the app has drifted
   for a week. For small tweaks, one screen (`--filter=home`) is enough.

## Solo-dev cadence (the "every aspect" checklist, prioritized)

The judge automates the *checking*; you only do the fixing. Weekly pass, in
this order (each is a `ui:shots`/`ui:judge` run plus fixes):

1. **Mobile works** — the 390px shots exist and score ≥7 (no overflow/scroll).
2. **Text readable** — body ≥15px, labels ≥13px, contrast on-token.
3. **One obvious action per screen** — the judge's "focal action" axis.
4. **Consistent spacing** — everything on the 4px rhythm.
5. **States not broken** — empty/loading/error renders look intentional
   (a state IS design; the `home` empty greeting card is the model).

## Extending the loop

- **More screens:** add an entry to the `SHOTS` array in
  `scripts/ui-shots.mjs` (name, path, a `wait` selector that proves the page
  reached its real state) + a line in `SCREEN_GUIDE` in
  `scripts/ui-judge.mjs`. Signed-in screens need a session: drive a login
  first in the script (see the stale `scripts/demo-shots.mjs` in
  `.claude/worktrees/` for a working login-flow example) — never screenshot a
  real user's data; use a throwaway account.
- **Changing the design language:** edit `docs/ui-rubric.md` — the judge reads
  it every run.
- **CI:** `npm run ui:shots && npm run ui:judge -- --fail-on-high` on a
  self-hosted runner with Chrome; screenshots + report as artifacts.

## What this loop does NOT catch (be honest about it)

- Real interaction bugs, keyboard flow, motion feel — for those, run the app
  and click through; the vision judge sees one static frame.
- Precise contrast math — spot-check suspicious pairs with a contrast
  checker (WebAIM); the token set was chosen AA-safe.
- Taste — the judge is a consistency engine. The final "does this feel like a
  product?" call is still a 10-second human look, scheduled not optional.
