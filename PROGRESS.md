# Voice Debrief — Progress

A single-user daily debrief tool. Type (later: talk) your day → Gemini extracts structured rows → an editable doc → browse entries + check off tomorrow's plan. Design reference: `~/Documents/job/CV/voice-debrief-design-spec.md`.

**Status (2026-07-16): usable daily.** Write (quick monologue **or** guided interview), review, plan — all working end-to-end live.

## What works (verified live)
- **Write** (`/new`): transcript → dual-model Gemini (`gemini-3.5-flash` strong extraction ‖ `gemini-3.1-flash-lite` fast overview) → editable doc at `/session/[id]`.
- **Guided interview** (`/interview`): a small-model driver (`gemini-3.1-flash-lite`) runs a reflect-then-probe chat interview — ≤1 probe/turn, zero advice, deterministic asked-fields checklist (events/decisions/next_steps), cross-session adaptation from `user_state`. On Finish, the user's turns feed the **same** extraction pipeline. Live-verified (reflects → probes events → probes decisions).
- **Review** (`/session/[id]`): editable doc — edit / add / delete(+undo) / reclassify (move between sections). Edits write back `source='user'`, `was_corrected=true`. Section header icons; redaction clean (no ids/table names in visible DOM).
- **See notes + plan** (`/`): Home = **Tomorrow's plan** (open next_steps with check-off → marks done) + **Recent entries** (clickable cards: date, mood/energy, overview).
- Extraction is Zod-validated with a 3-attempt retry (7/7 deterministic selftest; live extraction produces correct payloads).

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
Key files: `src/lib/{extract,overview,interview,llm-call,json,store,mutations,reclassify,queries,session,extraction-schema,constants,dates}.ts`, `src/actions/{debrief,interview}.ts`, `src/components/{DebriefDoc,PlanList,MoodStrip}.tsx`, `src/db/schema.ts` (mirrors spec §5).

## Stack & setup
Next 16 (App Router, TS, Tailwind v4) · Postgres + Drizzle (node-postgres) · Zod v4 · openai v6 SDK.
`cp .env.example .env.local`; fill `LLM_API_KEY`; `npm run db:migrate && npm run db:seed && npm run dev`. DB uses an isolated `voice` role + `voicedebrief` database on the local brew Postgres. Full details in `README.md`.

## Models / provider
Provider-neutral `LLM_*` env. Currently the **Z.ai Coding Plan** endpoint:
`LLM_BASE_URL=https://api.z.ai/api/coding/paas/v4`, `LLM_MODEL=glm-4.6` (strong, thinking), `LLM_SMALL_MODEL=glm-4.5-air` (fast — overview + interview driver). Verified live (extraction + 2-turn interview). Both reuse `callJsonValidated` (json_object + Zod + retry).
- **Fallback (commented in `.env.local`):** Google Gemini free tier — `gemini-3.5-flash` / `gemini-3.1-flash-lite`; general-use, no plan/ban risk.
- `glm-4.6` is a thinking model → `extract.ts` sets `max_tokens: 8000`; extraction is slowish (~30–90s).
- Swap providers (Z.ai / Gemini / OpenRouter / OpenAI / Ollama) via env only — no code change.

## Not done (deferred — see spec §9/§10)
Voice/STT (slice 3); 2-stage async fast/slow (overview is single-shot, not progressive); cross-day insights (slice 4); embeddings/pgvector; multi-user/auth.

Known slice-1 gaps:
- Undo restores text only, not tag chips.
- `user_state.last_session_id` FK is `NO ACTION` — can't delete the "last" session without clearing the ref first.
- No per-row confidence scores (the ⚠ heuristic was removed for visual consistency; defer until real confidence exists).
- `gemini-3.5-flash` sometimes emits free-form strings for `due_on`/`occurred_at` (stored null if unparseable).

## Suggested next steps
1. **Slice 3 — voice/STT**: batch Whisper (record → transcribe → feed `/interview` or `/new`), then real-time streaming.
2. **Cross-day review rollup**: the spec's conditional insight (needs a few sessions + a strong-model pass).
3. **Goal management UI** (goals currently emerge only via next_steps).
4. **2-stage async fast/slow** + the preloaded-lagged-insight trick (spec §3).
