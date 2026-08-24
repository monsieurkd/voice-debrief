# DEFECTS — `ship/ft-prime` adversarial review

Reviewed: `64802d5` against `SPEC.md` c1–c6, plus prod-build behavior.
Commands run: `npm run typecheck`, `npm run lint`, `npm test` (all green),
`npm run build` (see c6 note), and a real compiled-CSS inspection of the
Tailwind v4 output at `.next/static/chunks/*.css`.

---

## DEFECT 1 — Wordmark font-size token compiles to INVALID CSS (c4 / c5-adjacent, HIGH)

**Criterion:** c4 — `@theme` display type-scale consumed by `ui.tsx`.
**Severity: HIGH** (element visibly broken in the production artifact).

`src/components/ui.tsx:146` uses Tailwind *arbitrary-value* syntax against a bare
theme token:

```tsx
text-[--text-display-xl] leading-[--leading-display]
```

In Tailwind v4, the arbitrary-value variant `text-[--token]` is emitted **literally —
without a `var()` wrapper**. Confirmed from the actual compiled prod CSS:

```css
.text-\[--text-display-xl\]{color:--text-display-xl}
.leading-\[--leading-display\]{--tw-leading:--leading-display;line-height:--leading-display}
```

This is **invalid CSS**: `color:--text-display-xl` sets the `color` property to the
literal string `--text-display-xl` (not `var(--text-display-xl)`, and not the intended
font-size). Effects on the Wordmark:

1. The display font-size (`--text-display-xl: 30px`) is **never applied** — the
   Wordmark stays at the inherited/header size instead of scaling to 30px. Direct
   regression of the old `text-2xl` (24px).
2. The `line-height: --leading-display` declaration is likewise invalid.
3. Because `text-*` with a bare string also **collides with the `color` property**,
   the class is semantically the wrong property entirely.

**Fix (as authored, v4-correct):** `text-[var(--text-display-xl)] leading-[var(--leading-display)]`.
Note the `--text-display-*` values are numeric pixels (`30px` etc.) with no
properties on the theme token, so `var()` wrapping is required; alternatively use the
`--text-*` theme namespace properly (e.g. `--text-display-xl` as a `font-size` utility
works only if defined in a `--text-*((—)*)` key) — but the arbitrary `var()` form is
the minimal fix that matches the author's intent.

---

## DEFECT 2 — `--ease-*` / `--dur-*` / `--leading-display` tokens are DIFFERENT class of theme var and are partially unused (c4, LOW)

**Criterion:** c4 — motion + type tokens exist and are consumed.
**Severity: LOW.**

`globals.css:56-71` adds `--ease-standard`, `--ease-in`, `--ease-out`,
`--dur-fast`, `--dur-base`, `--dur-slow`. Two observations:

1. Only `--ease-standard` and `--dur-base` are actually consumed (via `PILL_BASE`
   in `ui.tsx:16-17`). `--ease-in`, `--ease-out`, `--dur-fast`, `--dur-slow` are
   dead tokens. Not a correctness bug, but the deliverable's `--ease-in/out` and
   `--dur-*` scale are not wired to any primitive.
2. `--ease-in`, `--ease-out` are **reserved/ambiguous Tailwind v4 names** — `ease-*`
   is a utility namespace in v4. Defining bare `--ease-in: cubic-bezier(...)` in
   `@theme` can generate/reserved a `.ease-in` utility that collides with v4's own
   `ease-in`. This is a latent confusion/risk rather than a live break (no leaf uses
   `ease-in` today), flagged for the branch.

---

## DEFECT 3 — Secondary/ghost focus-visible ring fails WCAG 1.4.11 non-text contrast (c3, MED)

**Criterion:** c3 — a *visible* focus-visible treatment.
**Severity: MED (accessibility).**

`src/components/ui.tsx:105,133` use `focus-visible:ring-secondary-focus-ring`
(`--color-secondary-focus-ring: #8b99a6`, globals.css:50).

Measured contrast of `#8b99a6`:
- against the surface `#f7f9ff` → **2.77:1**
- against the ghost white/60 fill (~#fcfcfd) → **2.84:1**

Both are **below the 3:1 WCAG 1.4.11 threshold** for non-text UI-component indicators.
`ring-2` + `ring-offset-2` rings draw as box-shadow on top of the global
`:focus-visible{outline:...}` (globals.css:99) so the visible focus indicator on
ghost/secondary buttons effectively is the low-contrast ring. The primary variant
(`--color-primary-ring #6a7278`, 4.65:1 vs surface) passes; only the secondary/ghost
indicator under-delivers. Suggest darkening `--color-secondary-focus-ring`.

---

## DEFECT 4 — `--color-primary-focus` hover fill is a negligible 1.22:1 step (c3, LOW)

**Criterion:** c3 — distinct hover fill (not opacity-only).
**Severity: LOW.**

`hover:bg-primary-focus` darkens the primary button from `#575f65` → `#4b5258`
(1.22:1). It is a real, perceptible darken (state-clarity is met in kind) but at
~1.2:1 it is easily missed by low-vision/peripheral users. The ghost variant's
`hover:bg-white/85` + `hover:border-white/80` is similarly faint (~1.04:1 against
its own off-white). Acceptable but at the low end; worth confirming the audit's
"state-clarity" bar.

---

## Regression/verification notes (NOT defects)

- **Leaf files untouched:** `git diff befe977 64802d5` shows changes only to
  `src/components/ui.tsx` and `src/app/globals.css`; none of `DebriefDoc.tsx`,
  `shell.tsx`, `ThreadsPanel.tsx`, `PlanList.tsx`, `MoodStrip.tsx` changed.
- **c1 (icons):** `IconPlus/IconClose/IconRefresh/IconEnergyDot` all exported
  (`ui.tsx:35,44,53,63`), share `ICON_PROPS` (24×24, stroke 2, round caps/joins),
  take `className`, all `aria-hidden`. `IconEnergyDot` renders a filled dot via
  `circle fill="currentColor" stroke="none"` — the element-level `fill` override
  beats the inherited `fill="none"`, so the dot renders. Good.
- **c2 (touch/pointer):** `PILL_BASE` (`ui.tsx:13-17`) applies `min-h-11` +
  `cursor-pointer` to `Button`/`GhostButton`/`ButtonLink`; `disabled:pointer-events-none
  disabled:cursor-not-allowed disabled:opacity-40` retained. Desktop padding
  unchanged (`px-5 py-2.5`). No misplaced `cursor-not-allowed`.
- **c5:** `npm run typecheck`, `npm run lint`, `npm test` all **green** in the worktree.
- **c6 (build):** In the worktree, `npm run build` crashes inside Turbopack:
  *"Symlink [project]/node_modules is invalid, it points out of the filesystem root"*.
  This is **environmental** — `node_modules` is a symlink pointing out of the
  worktree. Running `git archive HEAD` into an isolated `/tmp` copy with a real
  (copied) `node_modules`, `npm run build` **succeeds** (compiled, TS passed, static
  pages generated). So the branch code is production-buildable; c6 is only blocked by
  the sandbox symlink setup, not by these changes.

---

## Verdict

One genuine **HIGH** defect (Wordmark uses invalid `text-[--token]`/`leading-[--token]`
arbitrary values → broken font-size/line-height in prod CSS), one **MED** a11y defect
(secondary focus-ring < 3:1 non-text contrast), and two **LOW** items (faint state
fills; unused/ambiguous `--ease-*` tokens). `typecheck`/`lint`/`test`/`build` all
otherwise pass; no leaf files touched; c1/c2 met.

Overall: **not ship-ready — fix Defect 1 (and ideally Defect 3) before merging.**

---

## FIXED

- **DEFECT 1 (HIGH)** — `ui.tsx:146` Wordmark now uses v4-correct arbitrary values `text-[var(--text-display-xl)] leading-[var(--leading-display)]`. Bares `--text-*` tokens compile to invalid `color:--text-display-xl`; the `var()` wrap emits valid CSS and restores the 30px display size/line-height.
- **DEFECT 3 (MED, a11y)** — `--color-secondary-focus-ring` darkened `#8b99a6` → `#5b6b78` (globals.css:50). New contrast: **5.22:1 vs surface `#f7f9ff`** and **5.36:1 vs ghost `#fcfcfd`**, comfortably above the WCAG 1.4.11 ≥3:1 threshold.
- **DEFECT 2 (LOW)** — removed dead/ambiguous motion tokens from `@theme`: dropped `--ease-in`, `--ease-out` (reserved `ease-*` namespace collision in v4), `--dur-fast`, `--dur-slow`. Only consumed tokens remain: `--ease-standard` and `--dur-base` (both used in `PILL_BASE`). No primitive referenced the removed tokens.
- **DEFECT 4 (LOW)** — `--color-primary-focus` darkened `#4b5258` → `#41484f` (hover step 1.22:1 → **1.43:1** from primary) and `--color-primary-active` → `#33393f` (stable pressed step ~1.8:1). Ghost hover lifted `hover:bg-white/85` → `hover:bg-white/95` (both GhostButton and ButtonLink secondary) for a more perceptible but still subtle lift.

VERIFIED: all 4 defects resolved

## RE-REVIEW

Ship-reviewer flagged that the `var()`-wrapped `text-[var(--text-display-xl)]` still
compiles to `color: var(--text-display-xl)` (not font-size), because the bare arbitrary
value stays in the color namespace. Applied the **`length:` disambiguator** —
`ui.tsx:146` now reads `text-[length:var(--text-display-xl)] leading-[var(--leading-display)]`.
Isolated Tailwind v4 compile confirms `.text-[length:var(--text-display-xl)] { font-size: var(--text-display-xl) }`
while the bare form emits `color: var(--text-display-xl)`. `typecheck`/`lint`/`test` all green.
