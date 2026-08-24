# DEFECTS — Leaf L3 MoodStrip adversarial review

Reviewed: commit `a5b928f` against `SPEC.md` c1–c6 plus the color-not-only /
accessibility intent (audit #5).
Commands run: `npm run typecheck`, `npm run lint`, `npm test` (all green), plus
static inspection of `src/components/MoodStrip.tsx`, `src/components/ui.tsx`,
`src/app/globals.css`, and the consuming pages.

---

## DEFECT 1 — Inactive energy dots are effectively invisible on the card surface (MED, a11y / color-not-only)

**Criterion:** c2 (color-not-only) / audit #5 intent — "count energy" must work in
grayscale.
**Severity: MED** (the color-not-only *differentiation* exists, but the low side
under-perceives).

`MoodStrip.tsx:22-27` renders inactive dots as `text-outline-variant` + `opacity-50`.
`--color-outline-variant: #c4c7ca` (@globals.css:22) at 50% opacity over the card
`bg-surface-container-low` `#f0f4fc` blends to an effective **~#DADEE3 → ≈1.22:1
contrast**.

- Active dot: `text-on-surface` `#171c22`, `opacity-100` → ~14:1 → clearly visible.
- Inactive dot: ~1.22:1 → **near-invisible**.

Because the differentiation the fix relies on is *dark vs light*, a grayscale or
colorblind reader must distinguish the five 12px dot positions from the card
background and the 2px gaps between them. At 1.22:1 the inactive dots essentially
vanish, so the full meter extent (e.g. "3 of 5") is hard to count by sight — the
active dark dots reveal how many are lit, but the faint inactive ones can't be
reliably distinguished from empty slots. If the intent is a *quiet* but perceptible
empty meter, `opacity-50` on `outline-variant` over a near-white surface is too
faint; consider a darker empty tint (e.g. `text-outline`/`text-on-surface-variant`
at higher opacity) so the empty slots stay countable without color.

No change to overall verdict impact: the dot *count* is still correct via the dark
vs light cue and the `aria-label="energy N of 5"` — this is a perceptibility-quality
gap, not a wrong-count.

---

## DEFECT 2 — `neutral` mood text marginally below WCAG AA (LOW)

**Criterion:** SPEC deliverable 4 — "Ensure the mood label stays readable."
**Severity: LOW.**

`MOOD_COLOR.neutral = 'text-on-surface-muted'` → `#6b7280` (@globals.css:20).
Over `bg-surface-container-low` `#f0f4fc` that is ≈**4.39:1** — just under the
WCAG AA **4.5:1** threshold for normal text (`text-xs` = 12px). Barely perceptible
under-read. Not a color-only problem (the literal `neutral mood` text + `aria-label`
carry the meaning regardless of hue), and identical to the pre-existing app-wide
muted tint — but worth a nudge (`text-on-surface-variant` `#44474a` ≈ 7.5:1) to be
cleanly AA-clean.

---

## Verification notes (NOT defects)

- **c1 — no `●` glyphs:** `grep '●' src/components/MoodStrip.tsx` → no matches;
  `git show HEAD~1:... | grep -c '●'` = 1 (removed). All 5 dots are `IconEnergyDot` (`ui.tsx:63`).
- **IconEnergyDot is a filled dot:** `<circle cx=12 cy=12 r=5 fill="currentColor" stroke="none">`
  inside `<svg {...ICON_PROPS}>`. `ICON_PROPS` sets `fill="none"` on the `<svg>`, but the
  `<circle>`'s own `fill="currentColor"` attribute overrides it at the element level, so the
  dot fills via `currentColor`; inherited `color` drives it. `aria-hidden` on the svg keeps
  the 5 dots silent (the container span carries the `role="img"` + `aria-label`). Good.
- **c2 — active vs inactive distinguished beyond hue:** active = dark `text-on-surface` +
  `opacity-100`; inactive = light `text-outline-variant` + `opacity-50` — differs by
  fill/luminance/opacity, not hue alone. Met (see DEFECT 1 for the faintness caveat).
- **c3 — mood not color-only:** muted/`neutral`/`high` cases render the literal text
  `"{mood} mood"` (e.g. "low mood", "neutral mood", "high mood") *and* set `role="img"`
  + `aria-label=\`${mood} mood\``, so low/neutral/high reads regardless of color. Met.
- **c4 — aria preserved:** `aria-label=\`energy ${energy} of 5\`` retained on the energy
  span (`MoodStrip.tsx:17`), now paired with `role="img"`. Met.
- **c5 — verification green:** `npm run typecheck`, `npm run lint`, `npm test`
  (80 pass, 0 fail) all pass in the worktree.
- **c6 — only one file changed:** `git diff 8443933 a5b928f --stat` → only
  `src/components/MoodStrip.tsx` (22+/6−). No edits to `globals.css`, `ui.tsx`, or other files.
  (`SPEC.md` is untracked in the worktree but is the spec, not a code change.)
- `role="img"` on the energy span + `role="img"` on the mood span both expose a
  populated accessible name; no empty-image or dangling-label issue found.

---

## Verdict

c1–c6 are **met** (all three checks green; only `MoodStrip.tsx` changed; no `●`
remain; dots are filled SVG; active/inactive differ beyond hue; mood has a
color-independent text + aria cue; energy `aria-label` preserved).

One **MED** a11y defect (inactive dots near-invisible at ~1.22:1 over the card —
undercuts the grayscale "count energy" goal), one **LOW** (the `neutral` mood tint
is ~4.39:1, just under WCAG AA for small text).

Recommend addressing DEFECT 1 (darken the inactive empty-dot treatment) before
merging; DEFECT 2 is optional polish.

---

## FIXED

Reviewed and fixed in `src/components/MoodStrip.tsx` (only file changed; globals.css /
ui.tsx untouched — all tokens referenced already existed).

### DEFECT 1 — FIXED (inactive energy dots now countable)
Changed the inactive-dot class from `text-outline-variant opacity-50` to
`text-on-surface-variant opacity-70`. Effective blend over card
`bg-surface-container-low #f0f4fc`:
- **Before:** `#c4c7ca @ 50%` → `#dadee3` → **≈1.23:1** (near-invisible).
- **After:** `#44474a @ 70%` → `#787b7f` → **≈3.86:1** — empty slots now reliably
  distinguishable from the card background in grayscale/colorblind, keeping the
  "count energy N of 5" goal intact.
- Active `text-on-surface opacity-100` (≈15.5:1) stays clearly darker, so the
  active-vs-inactive cue remains luminance/fill/opacity only (not hue-only).
- Verified via WCAG contrast math (luminance + alpha premultiply over the card bg).

### DEFECT 2 — FIXED (neutral mood cleanedly AA)
Changed `MOOD_COLOR.neutral` from `text-on-surface-muted` to
`text-on-surface-variant`.
- **Before:** `#6b7280` over `#f0f4fc` → **≈4.39:1** (just under WCAG AA 4.5:1).
- **After:** `#44474a` over `#f0f4fc` → **≈8.48:1** — cleanly AA for text-xs.
- Color-not-only intact: the `{mood} mood` literal text token + `role="img"` +
  `aria-label` still carry meaning independent of hue.

### Re-verification
`npm run typecheck` (clean), `npm run lint` (clean), `npm test` (80 pass / 0 fail)
all green from the worktree root. Only `src/components/MoodStrip.tsx` and
`DEFECTS.md` changed.
