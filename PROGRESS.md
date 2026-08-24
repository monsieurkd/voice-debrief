# Voice Debrief — Progress

A daily debrief tool, going from single-user v1 to **multi-user SaaS**. Type your day (voice lands in Phase 2) → LLM extracts structured rows → an editable doc → browse entries + check off tomorrow's plan. Design reference: `~/Documents/job/CV/voice-debrief-design-spec.md`.

**Status (2026-08-24):** Phase 2's last commercial blocker — **server-side batch voice STT** — shipped (the "voice debrief" name now keeps its promise in every browser). 78 unit tests + 6 DB suites green, production build green, proxy auth gate active. Next: Phase 3 (commercial launch: billing, legal, beta) with the remaining Phase-2 leftovers below. Earlier: 2026-08-18 vigorous 3-track review (correctness · security · product/market); target decided: **multi-user SaaS**. Phase 0 fixed the correctness/security-hygiene layer; the refinement package made the differentiator visible; Phase 1+2 now close the review's top blockers (auth, tenancy, voice, wait UX, archive/search, streak).

## What works (verified live 2026-07-16; code re-read in review 2026-08-18)
- **Write** (`/new`): transcript → dual-model LLM (strong extraction ‖ fast overview) → editable doc at `/session/[id]`.
- **Guided interview** (`/interview`): small-model driver runs a reflect-then-probe chat — ≤1 probe/turn, zero advice, deterministic asked-fields checklist, cross-session adaptation from `user_state`. On Finish, user turns feed the same extraction pipeline.
- **Review** (`/session/[id]`): editable doc — edit / add / delete(+undo) / reclassify. Edits write back `source='user'`, `was_corrected=true`.
- **See notes + plan** (`/`): Home = Tomorrow's plan (check-off) + Recent entries (mood/energy/overview cards).
- Extraction is Zod-validated with a 3-attempt retry; failure still persists the session so **the transcript is never lost** (the architecture's best decision — held up under review).
- Failure-mode review note: the above works on the happy path; see Phase 0 for the edge cases that bite.

## Architecture
```
/interview (client chat) → interviewTurnAction (server) → runInterviewTurn (small model: reflect+probe, returns {reply,covered})
    └─ on Finish: join user turns → transcript
/new (client form) ──────────────────────────────────────────────────────────┐
                                                                               ▼
                                                                       runDebrief (server action)
  ├─ generateOverview()   FAST model → 2-liner overview
  └─ extractDebrief()     STRONG model → Zod payload (events/reflections/decisions/next_steps + tags + metadata)
       └─ storeSession()  transactional → sessions + rows + tags/tag_links + user_state
            └─ redirect → /session/[id] (server) → <DebriefDoc> (client, editable)

/ (Home, server) → listSessions() + listOpenNextSteps() → <PlanList> (client, check-off)
```
Validated-LLM-call engine shared by extraction + interview: `src/lib/llm-call.ts` (`callJsonValidated` — json_object + Zod + retry).
Key files: `src/lib/{extract,overview,interview,llm-call,json,store,mutations,reclassify,queries,session,extraction-schema,constants,dates}.ts`, `src/actions/{debrief,interview}.ts`, `src/components/{DebriefDoc,PlanList,MoodStrip}.tsx`, `src/db/schema.ts`.
Note: no `proxy.ts`/middleware exists yet — the auth gate lands in Phase 1 (in Next 16, middleware is renamed **`proxy.ts`**).

## Stack & setup
Next 16 (App Router, TS, Tailwind v4) · Postgres + Drizzle (node-postgres) · Zod v4 · openai v6 SDK.
`cp .env.example .env.local`; fill `LLM_API_KEY`; `npm run db:migrate && npm run db:seed && npm run dev`. DB uses an isolated `voice` role + `voicedebrief` database on the local brew Postgres. Full details in `README.md`.

## Models / provider
Provider-neutral `LLM_*` env. Currently the **Z.ai Coding Plan** endpoint: `LLM_BASE_URL=https://api.z.ai/api/coding/paas/v4`, `LLM_MODEL=glm-4.6` (strong, thinking), `LLM_SMALL_MODEL=glm-4.5-air` (fast — overview + interview driver).
- **Fallback (commented in `.env.local`):** Google Gemini free tier — `gemini-3.5-flash` / `gemini-3.1-flash-lite`.
- `glm-4.6` is a thinking model → `extract.ts` sets `max_tokens: 8000`; extraction is slowish (~30–90s).
- Swap providers (Z.ai / Gemini / OpenRouter / OpenAI / Ollama) via env only — no code change. For SaaS: revisit whose API terms allow reselling (see Phase 3).

## Market context (2026-08 review)
- Priced neighbors: **Rosebud** $12.99/mo (category leader; voice + native apps), **Mindsera** ~$12.99–14.99 (already markets "next steps"), **Reflection** ~$5.75–9.99, **Day One** $50–100/yr (trust/export incumbent). Voice-first niche already exists: AudioDiary, Dayora, Vaulti.
- **Real differentiators to lean on:** editable structured extraction with correction write-back (no competitor lets users fix the AI's structured rows) · plan-first home (action loop vs everyone's insight loop) · deterministic interview checklist · BYOK / self-hostable privacy wedge.
- Duplicated, not differentiating: guided chat interview, mood strip, AI overview, "AI extracts next steps".
- **Voice unshipped is commercially fatal under this name** — the README pitch is "typing is the last thing you'll do." The pipeline is transcript-agnostic, so batch STT is a medium slice, not a rebuild.

## Roadmap to market (2026-08-18)

Order rationale: **correctness first** (every later phase builds on these functions; silent failures are refund generators), **then auth + tenancy** (structural gate for billing, per-user limits, GDPR; doing it before new features avoids re-threading `userId` through them), **then the product slice** that makes it sellable, **then commercial launch**. Rough total: 6–9 weeks solo.

### Phase 0 — Stabilize the core (correctness + security hygiene) · ✅ DONE 2026-08-18
1. **Wire real tests**: add `npm test` running `extract-selftest` (the only script that actually asserts); convert `test-store/-writeback/-reclassify/-interview` to assert + exit non-zero (they print and exit 0 today — they cannot fail CI); add unit tests for `dates.ts` (highest bug density, zero coverage).
2. **Fix `dates.ts` timezone bugs**: human dates ("August 19, 2026") shift a day early in any TZ east of UTC via a local-midnight→UTC round trip ("Aug 19" even parses as year 2001); `toLocaleDateString` in Server Components renders in the *server's* TZ (an 11pm Vietnam debrief labels as the previous day on a UTC deploy). Make parsing timezone-explicit; render in the user's TZ.
3. **Stop swallowing extraction failures**: fail fast on invalid/missing API key *before* storing; for transient failures keep the persist-anyway behavior but return the failure cause and display it on the session page (today every failure mode is an identical silent empty session).
4. **Fix retry logic** (`llm-call.ts`): transport errors (timeout/429/ECONNRESET) currently get **zero** retries while schema errors get 3 — invert that with backoff; treat `finish_reason === 'length'` as a budget problem (raise `max_tokens` or fail loudly), not a retry-at-same-budget loop that truncates 3× then silently empties the session.
5. **Client error handling at every action call site** (`new/page.tsx`, interview finish, all `DebriefDoc` handlers, `PlanList.markDone`): try/catch + friendly message + retry, reset pending/busy state — a rejection today sticks the button on "…" forever. Undo: keep the block client-side until the re-insert succeeds (the current path can destroy the text permanently).
6. **Home freshness**: Home is eligible for build-time prerender under this Next version's default caching and `runDebrief` never revalidates `/` — new sessions won't appear until an unrelated action. Fix: `export const dynamic = 'force-dynamic'` and/or `revalidatePath('/')` in `runDebrief`.
7. **Tomorrow's plan horizon**: window the query — today it returns *every open step forever*, only shrinking by manual check-off.
8. **Security hygiene**: bump `next` ≥ 16.2.11 (9-CVE security release, incl. unauthenticated SSRF — 16.2.10 is affected); add security headers in `next.config.ts` (HSTS, frame-ancestors, Referrer-Policy; CSP later); compose Postgres → bind `127.0.0.1` + real password (currently `voice/voice` on all interfaces); stop returning raw `e.message` to clients; `/session/[id]` with non-numeric id → `notFound()` (today: DB 500); runtime-Zod-validate action inputs (bounded text, valid `entityType`).
9. **Small correctness**: make `deleteRowEntity` transactional; `MoodStrip` renders "high energy" when energy is null; drop dead `uncertain` field + stale comments; `make-demo.ts` hardcodes Gemini names vs GLM env.

**Done when:** `npm test` fails on real regressions; a forced LLM failure shows a readable cause; no known path loses user text; `next build && next start` shows fresh data on Home.

### Phase 1 — Multi-user foundation (auth + tenancy + limits) · ✅ DONE 2026-08-19
1. **Auth — ✅**: scrypt password hashing + jose-signed session cookies (30-day TTL, HttpOnly/SameSite=Lax, Secure in prod); `/signup` / `/login` / logout; `src/proxy.ts` route gate **plus** `requireUser()` at the top of every server action (self-authorization — the proxy is optimistic only). Seeded account: `you@example.com` / `SEED_PASSWORD` (default `devpassword`).
2. **Tenancy — ✅**: userId threaded through `queries/session/mutations/reclassify/store` — every write fails closed via `.returning()`-authz or ownership checks (`RowOwnershipError`); `listOpenNextSteps` user-scoped via `sessions` join; tag_links reads guarded; unique index on `goals(user_id, lower(title))` — `resolveGoalId` is now insert-first atomic (fixes the create-duplicate race). Archive/FTS queries user-scoped at merge time (they were phase-2 additions phase-1 never saw).
3. **DB hardening — ✅**: `session_id` indexes on the four child tables; `user_state.last_session_id` → `ON DELETE SET NULL`.
4. **Abuse & spend caps — ✅ per-user rate limits**: debrief 5/h, interview turns 20/h, samples 30/h, threads 5/h, demo week 3/h — keyed by user id, DB-backed. Open: daily spend budget, `/api/health`, Referer fix (still localhost — cosmetic for non-OpenRouter providers).
5. **Data rights — ✅**: whole-session delete (transactional, tag_links cleaned) + per-session JSON export (route handler, self-authorizing). Open: bulk export.
6. **Ops — still open**: Sentry, backup runbook, provider spend alerts.

**Done when: ✅** — tenancy suite proves cross-user reads/writes are rejected; every action re-checks the session; export/delete per session.

### Phase 2 — The market slice (product) · ✅ DONE 2026-08-19 (minus noted leftovers)
1. **Voice input — ✅ v1**: Web Speech API mic on `/new` + interview **+ ✅ batch STT (2026-08-24)**: provider-neutral server-side transcription (`LLM_ASR_*`, falls back to the main `LLM_*` provider), a MediaRecorder tap-to-record button on `/new` + interview that works in **every** browser (Safari/Firefox/iOS included) and feeds the same transcript pipeline; per-user cap 20 clips/h; ASR env routing + error-mapping unit-tested. Leftover: real-time streaming voice, audio file paste/upload.
2. **Extraction wait UX — ✅**: staged progress + timer + "safe to leave".
3. **Mobile pass — ✅**: touch-visible (`@media(hover:none)`) + `group-focus-within` edit controls, auto-growing interview composer (Enter sends / Shift+Enter newlines).
4. **Onboarding — ✅**: demo week + single samples, baked threads.
5. **Interview resilience — ✅**: sessionStorage draft per turn, restored on mount, capped at 60 messages, cleared on Finish.
6. **Archive + search — ✅**: `/archive` (pagination, tag chips, PG FTS on `search_tsv` generated column + GIN, ILIKE fallback for stopword-only queries).
7. **Habit loop — ✅ streak**: Home badge (app-TZ aware, unit-tested). Leftover: reminders, weekly rollup. **Threads — ✅** (cross-day insights v1).
8. **Polish — ✅**: error.tsx + not-found.tsx, undo fidelity (extras ride along). Leftover: PWA manifest; tag chips still not restored on undo (polymorphic tag_links).

**Threads (2026-08-19, spec slice 4 v1):** strong model reads the newest ~6 sessions → 2–4 cross-day threads (pattern/progress/nudge, date-grounded) → `insights` table (latest-snapshot) → "Threads this week" panel on Home + explicit refresh; regenerates in the background (`after()`) once ≥3 sessions exist. Demo week ships baked threads for the keyless payoff.

### Phase 3 — Commercial launch · ~1–2 wks + beta waiting
1. **Billing**: Stripe — free tier + paid (~$5–10/mo, anchored under Rosebud's $12.99); per-plan LLM caps enforcing Phase 1's budgets.
2. **Legal/trust**: ToS, privacy policy, AI disclosure ("your provider's LLM sees the transcript"), DPA if selling beyond consumers.
3. **Launch ops**: privacy-friendly analytics, transactional email (verify/reset/reminders), monitoring + runbook, prod migration procedure.
4. **Closed beta → pricing validation**: measure D7 retention and willingness to pay; position on the editable-extraction + plan-first + BYOK wedge.

**Done when:** a stranger can sign up, pay, and journal from their phone, with costs capped and observable.

## Deferred (post-launch)
Streaming/real-time STT · audio-file paste/upload (the recorder button covers live input; files can still be handled via the same action) · embeddings/pgvector semantic search · cross-day insights (spec slice 4) · weekly rollup · 2-stage async fast/slow + preloaded-lagged insight (spec §3) · goal-management UI beyond the plan · native apps · interview transcript including assistant turns (currently user-turns only — cost choice).

## Known issues (tracked in phases above)
Undo restores text only, not chips/`due_on`/`status` (P2) · `user_state.last_session_id` FK is `NO ACTION` (P1) · no per-row confidence scores (deferred until real confidence exists) · model-emitted free-form dates silently null (P0) · `resolveGoalId` duplicate-title race (P1 unique constraint) · interview drops assistant turns from the final transcript (deferred).
