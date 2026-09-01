# Voice Debrief — Knowledge Base

> Session cache: loaded automatically via `CLAUDE.md` (`@KNOWLEDGE_BASE.md`).
> This is the distilled, loadable picture of the project — what it is, how it
> works, what must not be undone, and where it's going. If it drifts from
> `PROGRESS.md` (the build log), `PROGRESS.md` is the longer truth.

---

## 1. What this is

A daily journaling app where you **talk (or type) through your day**, an LLM
turns the transcript into **structured, editable data** (events, reflections,
decisions, next steps + tags + mood/energy/pace), and an editable doc lets you
correct anything — so corrections **write back** into the data layer
(`source='user'`, `was_corrected=true`). Home shows tomorrow's plan (checkable
next steps) + recent entries + **cross-day threads** (the compounding made
visible) + a streak.

**Debrief-first onboarding (guest model).** The core act — the debrief — sits in
front of any auth wall. A brand-new visitor lands on the debrief without an
account (`/`, `/new` are always reachable); their first debrief
mints an anonymous **guest** user (a `users` row with `email`/`password_hash`
NULL, identified by a signed `vd_guest` cookie). When they later sign up or log
in, their guest sessions/threads/tags/goals are **adopted** onto the real
account (`adoptGuestData` in `src/lib/adopt.ts`) and the guest row is deleted.
Login is a quiet pill, never a gate.

Target: multi-user SaaS. Differentiators to defend: **editable structured
extraction with correction write-back** (no competitor lets you fix the AI's
rows), **plan-first home** (action loop, not insight loop), BYOK/privacy wedge.

**The name is the promise: reliable voice across browsers.** The Chromium-only
Web Speech live-dictation mic was removed; the **server-side batch STT**
recorder (`VoiceRecorder`, MediaRecorder → mono 16k WAV → provider-neutral
endpoint) is the one voice input and works on
Safari/Firefox/iOS — a tap-to-record button on `/new` transcribes through a
provider-neutral endpoint (`LLM_ASR_*`, falling back to the main `LLM_*`
provider) that feeds the same
transcript pipeline — so everyone can talk their debrief, not just type it.

**UI is the "Digital Sanctuary".** The app is styled to a meditative, glassy,
low-cognitive-load aesthetic (see `stitch_mindcloud_ai/DESIGN.md`): surface
`#f7f9ff`, primary container `#f0f8ff`, on-surface `#171c22`, `meditative-lavender`
chips, font-display `Playwrite DE Grund` for headings + `Open Sans` body, ambient
(borderless, focus-glow) inputs, ghost (breathing) loaders, floating cards,
glassmorphic nav shell. Design tokens live in `src/app/globals.css` `@theme`;
shared primitives in `src/components/ui.tsx`; the app frame is
`src/components/shell.tsx`. A reusable **UI/UX specialist agent** lives at
`~/.claude/agents/ui-ux.md` and encodes these rules.


## 2. Verified state (2026-08-24)

- **78 unit tests green, typecheck + lint green, prod build green, 6 DB
  integration suites** (`npm test`, `npm run typecheck`, `npm run lint`,
  `npm run test:db` with a migrated local Postgres).
- Phases **0 (stabilize), 1 (auth+tenancy), 2 (market slice)** done.
- Working: auth (scrypt + jose-signed cookies, 30-day TTL), tenancy
  (every query/mutation user-scoped, fails closed), voice input — **server-side
  batch STT recording (every browser) via `src/actions/voice.ts` +
  `src/components/VoiceRecorder.tsx`**, editable doc
  with undo/reclassify, archive + PG full-text search, threads, streak,
  per-user rate limits, per-session export/delete, demo week + samples.
- CI (`lint` → `typecheck` → `test` → `build`, plus a Postgres job running
  `test:db`) on every push/PR.

## 3. Architecture at a glance

```
/new (type) ─┐
              │
              ├──► voice path: <VoiceRecorder> (MediaRecorder, every browser)
              │        → transcode to mono 16k WAV (band-limited)
              │        → transcribeAudioAction (src/actions/voice.ts)
              │        → src/lib/asr.ts → LLM_ASR_* / LLM_* /transcriptions (429 retry)
              │        → text lands back in the composer
              │
              ├──► runDebrief (server action, src/actions/debrief.ts)
              │       ├─ generateOverview()   FAST model  (LLM_SMALL_MODEL)  2-liner
              │       └─ extractDebrief()     STRONG model (LLM_MODEL)       Zod-validated payload
              │            └─ storeSession()  ONE transaction: sessions + 4 child tables
              │                               + tags/tag_links + user_state (cross-session memory)
              └──► /session/[id] → <DebriefDoc> (editable; every edit writes back)
/
  Home (server, force-dynamic) → listSessions + listOpenNextSteps + threads + streak
```

- **Voice is one layered path**: a single MediaRecorder input mode resolves to a
  transcript that feeds the identical `runDebrief` extraction pipeline. The idea
  is "the data layer IS the product; voice is just the door."

- **Extraction never loses the transcript**: on LLM failure the session is
  still persisted (placeholder overview with the failure cause + raw
  transcript, no children) — the user can hand-add rows. This is the
  architecture's best decision; do not regress it.
- **Model routing by stakes**: fast model = overview; strong model = extraction
  + threads. Routed by cost-of-being-wrong.
- **Shared validated-LLM engine**: `src/lib/llm-call.ts` (`callJsonValidated`
  — `json_object` mode + Zod + bounded retry). Three failure classes, three
  strategies: transport → exp backoff; truncation → budget doubles once then
  fails loudly; schema → error fed back to model, retried up to `attempts`.
- **Threads** (`src/lib/threads.ts`): strong model reads newest ~6 sessions →
  2–4 date-grounded threads (pattern/progress/nudge) → `insights` table
  (latest snapshot wins). Regenerated in the background via `after()` once
  ≥3 sessions exist; explicit refresh capped at 5/h.

## 4. Key files map

| Area | Files |
|---|---|
| Actions (all self-authorize) | `src/actions/debrief.ts` (runDebrief, samples, demo week, threads, all doc edits), `auth.ts`, `voice.ts` (transcribeAudioAction — batch STT) |
| LLM engine | `lib/llm-call.ts`, `llm-client.ts`, `llm-errors.ts` (friendly `summarizeLlmError`), `asr.ts` (provider-neutral STT + `summarizeAsrError`), `extract.ts`, `extract-prompt.ts`, `overview.ts`, `extraction-schema.ts` |
| Data layer | `db/schema.ts`, `lib/store.ts` (transactional store), `mutations.ts`, `reclassify.ts`, `queries.ts`, `session.ts`, `dates.ts`, `streak.ts` |
| Auth | `lib/auth.ts` (getCurrentUser/requireUser + getGuestId/currentUserOrGuest — the real gates), `lib/session-token.ts` (jose sign/verify for session + guest cookies), `lib/passwd.ts` (scrypt), `lib/adopt.ts` (deferred attribution — moves a guest's data to a real user on signup/login), `proxy.ts` (optimistic, debrief-first route gate) |
| Other | `lib/rate-limit.ts` (DB-backed per-user windows), `lib/action-args.ts` (runtime Zod validation of action inputs), `lib/demo-week.ts`, `lib/sample-sessions.ts`, `lib/webm-to-wav.ts` (browser mono 16k WAV transcode), `lib/env.ts` (validates env at import) |
| UI | `components/ui.tsx` (Button/GhostButton/ButtonLink/Wordmark/Card/SectionTitle/Pill/Field/GhostLoader/AmbientTextarea/SaveToJournalPrompt — the Digital Sanctuary primitives), `components/shell.tsx` (app frame: wordmark, login pill, debrief CTA), `components/DebriefDoc.tsx` (the editable doc — largest component), `PlanList`, `ThreadsPanel`, `MoodStrip`, `VoiceRecorder` (MediaRecorder → server STT — every browser), `ExtractionProgress`, `DemoButton`, `DeleteSessionButton` |

## 5. Schema quick reference (`src/db/schema.ts`)

- `users` (id, email unique, password_hash `scrypt:<salt>:<hash>`)
- `sessions` — atomic unit; `user_id` FK cascade; `search_tsv` = STORED
  generated `to_tsvector('english', overview + transcript)` + GIN index
  (archive FTS); embedding column deliberately left commented (pgvector deferred)
- `goals` — long-lived, **unique (user_id, lower(title))** (kills the old
  resolveGoalId create-duplicate race; `resolveGoalId` is now insert-first atomic)
- `events` / `reflections` / `decisions` / `next_steps` — child tables,
  `session_id` FK cascade, **indexed by session_id** (Postgres doesn't auto-index FKs)
- `tags` (unique user/kind/name) + `tag_links` (**polymorphic, app-enforced,
  NO FK on entity_id** — the reason tag-chip undo restore is still a leftover)
- `user_state` — one row/user, overwritten each session; `last_session_id` FK `ON DELETE SET NULL`
- `rate_limits` — (bucket, window_start) PK, DB-backed so serverless
  instances share state; keys are now `debrief:u:{id}`, `sample:u:{id}`, etc.
- `insights` — stored threads; `related` jsonb holds {title, kind, dates}

## 6. Engineering decisions you must not undo

1. **Proxy gate is optimistic only, and debrief-first.** Next 16 renamed
   middleware → `proxy.ts`; it's deliberately self-contained (no DB). `/`,
   `/new` are always reachable (no identity required). Every
   server action re-authorizes itself via `getCurrentUser`/`currentUserOrGuest`
   and every query scopes by owner — cross-user/foreign ids fail closed
   (404/rejected write). Never rely on the proxy matcher as the boundary, and
   never move `/`, `/new` behind login (that would break the
   debrief-first promise).
2. **Server-action inputs are client-controlled HTTP payloads** — every action
   runtime-validates via `parseArgs` + Zod (bounded text, valid `entityType`).
3. **Failure is never silent**: fail-fast on config errors before storing;
   extraction failures persist-with-cause and are displayed. `e.message` is
   never returned raw to clients (`summarizeLlmError`).
4. **Date handling is timezone-explicit** (`lib/dates.ts`, unit-tested): parse
   with explicit zone, render in the user's zone via `APP_TIMEZONE`. The
   original local-midnight→UTC round-trip shifted days east of UTC and even
   parsed "Aug 19" as year 2001 — high bug density, now covered.
5. **Home is `force-dynamic`** + `revalidatePath('/')` after every write —
   a new session must appear immediately (build-time prerender would hide it).
6. **Provider-neutral `LLM_*` env**: swap OpenAI/Z.ai/Gemini/OpenRouter/Ollama
   with env only — no code change. GLM-4.6 is a thinking model → extraction
   uses `max_tokens: 8000` and is slow (~30–90s); the wait UX exists for it.
7. **Demo/seed paths make zero LLM calls** (pre-baked payloads through the
   same transactional pipeline) — the demo deploy is safe keyless, and tests
   pin baked payloads to the real schemas so drift breaks CI.

## 7. Next step (per the roadmap in PROGRESS.md)

**Phase 3 — commercial launch**, with the remaining Phase-2 leftovers first:
1. **Phase-2 leftovers** (small, queued): ~~server-side batch STT~~ **✅ shipped
   2026-08-24 (voice now works in every browser)** · audio-file upload (the
   live recorder covers input; files run through the same action) · reminders
   (retention hook) · weekly rollup · PWA manifest · tag chips on undo · bulk
   export · daily per-user spend budget · `/api/health` · Sentry + backup
   runbook.
2. **Phase 3 — billing (Stripe, free + paid ~$5–10/mo anchored under
   Rosebud's $12.99) → legal/trust (ToS, privacy, AI disclosure — "your
   provider's LLM sees the transcript") → launch ops (analytics, transactional
   email, monitoring, prod migration) → closed beta → pricing validation (D7
   retention + willingness to pay).**

Known issues to carry: undo restores text only (not chips/due_on/status) ·
model-emitted free-form dates silently null.

## 8. Senior-engineer recommendation

**Sequence the launch around the product's own thesis.** The roadmap lists
billing first, but billing is where you spend the most for the least
information. My order:

1. **~~Ship server-side batch STT next~~ — ✅ done 2026-08-24.** Web Speech
   is Chromium-only; the pitch is "voice debrief" and most mobile users are
   Safari. Provider-neutral transcription (`LLM_ASR_*`, falls back to the main
   `LLM_*` provider) + a MediaRecorder tap-to-record button on `/new`
   transcribe server-side and feed the existing transcript
   pipeline — voice works in every browser now, closing the commercially
   dangerous gap before anyone is asked to pay. Next: audio-file (paste/upload)
   still rides the same action.
2. **Run the closed beta BEFORE building Stripe.** A waitlist + invite
   (privacy-friendly analytics + D7 retention) costs almost nothing and tells
   you whether to build billing at all — and at what price. Build legal/trust
   pages in parallel (needed regardless). Billing is the last thing to build,
   not the first: it's pure overhead until someone has proven they'd pay.
3. **Land the daily per-user spend budget + Sentry before any paid key on a
   public deploy** — the rate limits bound counts, but not cost; a thinking
   model at 8000 tokens is the expensive path. This is the one Phase-1 open
   item that becomes urgent the moment real users arrive.
4. **Do not add pgvector/embeddings yet** (deferred for a reason): the
   tsvector FTS + threads already deliver the compounding story; semantic
   search is a post-launch nicety, not a launch blocker.

Bottom line: **voice for everyone → beta validation → legal → billing**, with
spend caps and monitoring in place before the beta door opens.
