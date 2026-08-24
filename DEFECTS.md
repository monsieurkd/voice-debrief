# DEFECTS — Leaf L1 (DebriefDoc), commit fe75f10

**Verdict: ACCEPT (1 medium, 3 low).** c1, c2, c3, c5, c6 pass cleanly. c4 passes
its letter (distinct hover/focus/pressed treatments exist and are not
opacity/color-only) but is materially weakened by D1: the hover fill is the same
color as the row's own hover fill, so it is imperceptible. No criterion outright
fails; the items below are what a GitHub-grade review would ask to address before
merge.

---

## D1 — MEDIUM — c4: hover fill is imperceptible (identical to parent row fill)

`src/components/DebriefDoc.tsx:285` — the row `<li>` carries
`hover:bg-surface-container`, and every non-delete control (add line 173, Save
270, Cancel 276, edit 298, move select 308) also uses `hover:bg-surface-container`.
The controls are children of the row, so hovering a control paints it the exact
same `#eaeef6` as the row already shows — 1.0:1, the fill literally cannot be
seen. The only perceivable hover change is the text-color shift (muted →
on-surface), i.e. color-only — precisely the anti-pattern c4/audit #4 exists to
avoid. The delete button fares only marginally better: its `hover:bg-error-container`
`#ffdad6` vs the row's `#eaeef6` is 1.11:1 (weak fill boundary); it reads mainly
through the icon turning `text-error` `#ba1a1a` (5.56:1 vs `#eaeef6`).

Root cause: the entire `surface-container*` palette sits within ~1.1–1.2:1 of
`surface` (e.g. `surface-container-high` `#e4e8f0` vs surface is 1.17:1), so no
fill token in this system can register against the row hover fill. Suggested fix
within scope (globals.css is off-limits): drop the row-level
`hover:bg-surface-container` and put the hover fill on the controls only, so the
control fill is seen against the plain `surface` instead of being swallowed by an
identical parent fill — or pair the fill with the existing text/icon color shift
and accept the subtle calm-palette look. Either way the current implementation's
hover fill is invisible.

## D2 — LOW — c3: nested/double focus ring when any control is focused

`src/components/DebriefDoc.tsx:292` — the controls container has
`focus-within:ring-2 ring-primary-ring`, and every child control (edit 298,
select 308, delete 321) additionally has `focus-visible:ring-2`. When the user
tabs to any control, both the container ring (around the whole edit/select/delete
cluster) and the control's own ring render at once → a redundant nested double
ring. Not a stray ring on hover-only devices (the container is `opacity-0`
unless focused/hovered, so `focus-within` fires only on genuine focus), but the
double indicator is visual noise. Suggested fix: keep the ring on either the
container (focus-within) or the controls (focus-visible), not both.

## D3 — LOW — c4/cosmetics: inconsistent transition list on text-color hovers

`src/components/DebriefDoc.tsx:173,270,276,298,308` — these controls
`transition-[background-color,transform]` but their hover state also changes
text color (`hover:text-on-surface`), so the color snaps instantly while the bg
fades; the delete button (321) correctly lists `color` in its transition. One-line
consistency fix.

## D4 — LOW — c5-adjacent (pre-existing): control label contrast on hover row

When the row is hovered (bg `#eaeef6`) and a control is not itself hovered, its
idle label `text-on-surface-muted` (`#6b7280`) sits at 4.16:1 — just under WCAG
AA 4.5:1 for the 12px (`text-xs`) labels "edit"/"Save"/"Cancel"/"move →". On
touch (`hover:none`) the row bg stays `#f7f9ff` and contrast is 4.59:1 (passes),
so the shortfall is mouse-hover-only and uses pre-existing tokens (not introduced
by this diff). Flagging for the contrast audit (audit #5); LOW.

---

## What was verified clean (no defects)

- **c1** — No `✕`/`＋`/`×` glyphs in `src/components/DebriefDoc.tsx`
  (`grep -n "✕\|＋\|❌\|×"` → no matches). `IconClose`/`IconPlus` imported from
  `@/components/ui` (`ui.tsx:35-50`), stroke via `currentColor`, `aria-hidden`
  decorative; delete button keeps `aria-label="Delete row"` (+ new `title`),
  add button has visible text label.
- **c2** — All 6 row controls (add 173, Save 270, Cancel 276, edit 298, move
  select 308, delete 321) have `cursor-pointer` and `min-h-11` (44px); the
  icon-only delete also `min-w-11`. No row control left <44px. Row stays compact:
  fills/rings do not enlarge text; the edit row grows to ~52px and the hover
  cluster to 44px, which is the SPEC's intended tradeoff.
- **c3** — Select's bare `outline-none` removed; now `focus-visible:ring-2
  ring-primary-ring ring-offset-2 ring-offset-surface` (ring contrast vs surface
  = 4.65:1, ≥3:1). Container `focus-within` ring fires only on real focus, so no
  stray ring on hover-only devices (see D2 for the double-ring caveat).
- **c4** — Distinct treatments present: hover bg-fill, `focus-visible:ring-2`,
  `active:scale-[0.97]` (not opacity/color-only). Delete hover `#ba1a1a` on
  `#ffdad6` = 5.00:1. Weakened only by D1.
- **c5** — `npm run typecheck` ✓ (exit 0), `npm run lint` ✓ (exit 0, no
  findings), `npm test` ✓ (80 pass / 0 fail).
- **c6** — `git show --stat HEAD` and `git diff main..HEAD` both show exactly
  `src/components/DebriefDoc.tsx` (15 insertions / 11 deletions); `git status`
  shows no other modifications (only untracked SPEC.md).
- **A11y** — `aria-label` preserved on both icon/meaningful controls (Delete row,
  Move to another section); icons are `aria-hidden` decorative; focus
  management unchanged (input auto-focus on edit) and sane.

## FIXED

- **D1 (MED, done)** — Removed `hover:bg-surface-container` from the row `<li>`
  (line 285). Controls keep `hover:bg-surface-container` + `hover:text-on-surface`,
  now seen against the un-filled `surface` instead of being swallowed by an
  identical parent fill. The hover state is now perceptible via a bg fill that
  contrasts the plain surface plus the text-color shift; delete keeps
  `hover:bg-error-container` + `hover:text-error`. `src/components/DebriefDoc.tsx`.
- **D2 (LOW, done)** — Dropped the container `focus-within:ring-2
  ring-primary-ring` (line 292); each control keeps its own
  `focus-visible:ring-2 ring-primary-ring` (edit/select/delete/Save/Cancel/add).
  One visible ring instead of a nested double ring.
- **D3 (LOW, done)** — Added `color` to the `transition-[...]` list on the
  controls that shift text color on hover (add, Save, Cancel, edit, move select);
  delete already had it. All six now
  `transition-[background-color,color,transform]`.
- **D4 (pre-existing)** — Left as-is per scope; tokens unchanged.

Verified: `npm run typecheck` ✓, `npm run lint` ✓, `npm test` ✓ (80 pass / 0 fail).
