# Voyo — UI QA rubric (used by `npm run ui:judge`)

The judge (a vision LLM) grades screenshots against this rubric and reports
`[high] / [med] / [low]` issues plus a `**Overall: n/10**` score. This file is
the executable spec — edit it when the design language changes, and the loop
follows automatically.

The anchor: **the tokens in `src/app/globals.css` and the primitives in
`src/components/ui.tsx` are the only source of truth.** Their visual contract:

- Canvas: a soft, pale lavender-white wash (`surface` #f7f9ff) with translucent
  hairline-bordered "glass" panels (`glass`, `glass-strong`) that float over it
  with a subtle backdrop blur — a calm, airy sanctuary canvas, not a flat grey
  dashboard. No mist-drift, no heavy shadows, nothing harsh.
- One restrained slate action accent (`primary`) drives the primary buttons,
  links and the commerce/sanctuary pill (Button, ButtonLink, primary calls to
  action). Error only in `error` tokens. ~60% neutral canvas, ~30% panels,
  ~10% accent. The send control / user bubble may use a single vivid azure in
  the same family ONLY if it is also tokenized in globals.css — otherwise fall
  back to `primary`.
- The assistant/listener carries its own calm identity via curated soft
  persona "aura" hues (`meditative-lavender` lavender for warm / sage for
  friend / slate-blue for coach). A persona shows ONE quiet hue and only on the
  listener cue (orb/avatar/swatch dot) so the listener reads as a person. The
  user's own actions stay the action accent above. Three vivid accents or
  persona hue leaking onto non-listener UI = an over-accent problem.
- Text ink from the `on-surface` scale (`on-surface` / `-variant` / `-muted`).
  Body copy ~15-16px, secondary ~13-14px, nothing under 12px, nothing muted
  that a user must read as primary.
- Spacing on the 4px rhythm (4/8/12/16/24/32…). One radius family
  (rounded-lg/xl/2xl + the pill buttons). Elevation only via the documented
  `.elev-1/.elev-2` scale — no one-off box-shadows.
- Headings in the display font (Playwrite DE Grund), body in Open Sans — no
  third font, no more than 2-3 weights visible on one screen.

## Scoring (1-10)

Judge each screenshot on all seven axes, weighted by severity:

1. **Token discipline** — do colours, fonts, radii, shadows look like they come
   from one system, or are there invented values (a hex colour that is not a
   token, an odd pixel padding, an ad-hoc glow)? Vibe-code smell: one element
   that doesn't match its siblings.
2. **Readability** — text size/weight for its role, contrast of every
   text-on-background pair, nothing overflowing, clipped, or colliding.
3. **Spacing & alignment** — rhythm on the 4px scale, consistent gutters and
   margins, elements sharing edges where they should, no cramped or floating
   orphans.
4. **Hierarchy & focal action** — the page has ONE obvious primary action,
   findable within ~3 seconds; secondary actions are visibly quieter; the
   title/heading outranks body copy.
5. **Consistency** — buttons/fields/cards look like the same component
   everywhere on the screen; borders and radii match; nothing hand-rolled
   next to a primitive twin.
6. **Mobile (390px) / responsive** — no horizontal scroll, no clipped or
   overflowed text, tap targets ≈44px tall, the layout is a sane one-column
   reading flow.
7. **Calm factor (wellness resonance)** — this is a mental-health / reflective
   product, so the aesthetic must read as a restful "sanctuary", not a generic
   utility SaaS. Judge whether the surface palette, accent and rhythm feel calm
   and human (soft near-neutral canvas, breathing room, at most two gentle hue
   presences — user `primary` + one listener persona cue), or whether it feels
   corporate/cold, cluttered, or hospital-like. Prefer token-level notes: which
   `glass` / `surface-container` step or which existing lavender/emerald persona
   tint would warm or decompress a spot. Never invent a new palette. A screen
   that is technically clean but reads emotionally cold/stressful should score
   below its otherwise-solid technical marks on this axis.

Then fold them into the single `**Overall: n/10**`:

- 9-10: ships as-is. 7-8: good; only `[low]` polish. 5-6: `[med]` issues —
  fix before calling the screen done. 1-4: broken or clearly off-contract
  (`[high]`) — fix before anything else ships.

## Rules of the judge (non-negotiable, they keep the loop converging)

- **Never prescribe a redesign or a new palette.** Issues must name the fix at
  token/primitive level: which `globals.css` token or `ui.tsx` component to
  use, which spacing step to move to. If the whole design language were wrong,
  say so in one line as `[high]` — but the default assumption is: fix against
  the system, not against your taste.
- **Judge the static screenshot only.** Don't penalise missing animation or
  hover states you cannot see. Do penalise an empty/loading/error state that
  looks broken (a state IS part of the design).
- **Concrete beats general.** "The card in the middle feels cramped" is
  incomplete; "the greeting card's right padding (px-6 → 4px grid ok) vs the
  button inside it are misaligned vertically" is a finding.
- **Broken page = 1/10.** Blank canvas, unstyled HTML, visible error/crash
  text, or a console-error page renders as a hard fail, reported first.
- **Accent is a spice.** If blue `primary` appears on more than ~1-2 places
  per viewport (or lavender `meditative-lavender` shows up unprompted on a
  neutral surface), flag `[med]`+.
