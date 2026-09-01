# Voice Debrief

[![Live demo](https://img.shields.io/badge/live-demo-2ea44f?style=flat-square)](#) <!-- replace # with the deployment URL — see DEPLOY.md -->
[![CI](https://img.shields.io/github/actions/workflow/status/monsieurkd/voice-debrief/ci.yml?style=flat-square)](https://github.com/monsieurkd/voice-debrief/actions/workflows/ci.yml)

> Talk (or type) through your day. Voice is transcribed server-side into text,
> a strong model turns it into **structured, queryable data**, and an editable
> document lets you correct anything — so a daily debrief compounds into a
> personal data layer you can search and act on.

**Status:** multi-user and demo-ready — **voice works in every browser**
(tap-to-record + server transcription, with fast, retry-resilient speech-to-text),
or type your day → structured, editable data → tomorrow's plan → **threads that
connect your days** — with per-user accounts, per-session export/delete,
archive + full-text search, and a streak. Email+password auth; every query
scoped by owner.

---

## Screenshots

**The journal that compounds: threads connect your days, the plan keeps you moving.**

![Home with the week's threads, tomorrow's plan, and recent entries](docs/screenshots/02-home-lived-in.png)

![A day becomes a structured, editable doc — every row fixable, movable, deletable](docs/screenshots/03-session-doc.png)

![Record or type — one smooth debrief flow](docs/screenshots/06-new.png)

---

## Why

Journaling and life-management apps fail for one reason: after a long day,
typing is the last thing you'll do — so recording and letting the app transcribe
is the friction-free door in. The real value isn't a faster unstructured
journal though. It's the second step: **turning the verbal (or typed) dump into
structured data that accrues over time.** Once that data layer exists, "a clear
look at your day + your next steps" falls out almost for free.

This project is also where I learned the part of LLM engineering that matters
most: **making LLM systems reliable enough to depend on.**

## What's non-obvious (the engineering)

- **Trustworthy extraction.** A strong model emits typed rows validated by
  **Zod** with a bounded retry loop (`json_object` mode + schema
  self-validation), so malformed output can never reach the database.
- **Model routing by stakes.** A fast model handles low-stakes fluency (the
  overview); a strong model handles high-stakes precision (extraction). Routed
  by the *cost of being wrong*, not raw capability.
- **Reliable voice.** The recorder transcribes to **mono 16 kHz WAV** with a
  proper band-limited resample + power-equal downmix (no aliasing / phase
  cancellation), then a provider-neutral endpoint with **exponential-backoff
  retry** turns transient rate-limits into a retry instead of a dead clip.
- **Human-in-the-loop data quality.** Every extracted row is editable, and each
  correction is written back (`source = user`, `was_corrected = true`), so
  extraction errors are surfaced and fixed instead of accumulating.
- **Multi-user with self-authorizing actions.** A signed session cookie
  (scrypt passwords, JWT via jose) gates routes via `src/proxy.ts` — but every
  server action *re-checks* the user itself, and every query/mutation scopes by
  the owner, so the gate is defense-in-depth, not the boundary. Cross-user ids
  fail closed (404 / rejected write), never leak data.

## Tech stack

Next.js (App Router, TypeScript, Tailwind) · PostgreSQL + Drizzle ORM · Zod ·
OpenAI-compatible LLM SDK — **bring your own key and provider.**

## Quick start (bring your own API key)

```bash
git clone https://github.com/monsieurkd/voice-debrief.git
cd voice-debrief
npm install
cp .env.example .env.local      # fill in LLM_API_KEY + provider, and AUTH_SECRET:
openssl rand -base64 32         # ← paste the output as AUTH_SECRET
```

One-time Postgres setup (run as a superuser; local dev only — pick a real
password for anything exposed beyond loopback):

```sql
CREATE ROLE voice LOGIN PASSWORD 'voice';
CREATE DATABASE voicedebrief OWNER voice;
```

Then:

```bash
npm run db:migrate && npm run db:seed && npm run dev   # http://localhost:3000
```

The app is multi-user: sign up at `/signup`, or log in as the seeded account
`you@example.com` / `devpassword` (override with `SEED_PASSWORD` before
`db:seed`; re-seeding never clobbers a changed password).

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `AUTH_SECRET` | yes | signs session cookies — generate with `openssl rand -base64 32`; rotating it logs everyone out |
| `LLM_API_KEY` | no | without it, live debriefs fail fast; instant samples still work |
| `LLM_BASE_URL` / `LLM_MODEL` / `LLM_SMALL_MODEL` | no | provider-neutral (Z.ai GLM by default) |
| `APP_TIMEZONE` | no | IANA name; the zone dates are interpreted and rendered in |
| `SEED_PASSWORD` | no | password for the seeded account (default `devpassword`) |

`LLM_*` vars are provider-neutral — point them at OpenAI, Z.ai (GLM), Google
Gemini (OpenAI-compatible endpoint), OpenRouter, or a local Ollama model. See
[`.env.example`](.env.example).

## Testing & checks

```bash
npm test          # unit tests (node:test) — deterministic, no DB or API key needed
npm run typecheck
npm run lint
npm run test:db   # DB-integration scripts — needs a migrated local Postgres
```

CI runs lint + typecheck + test + build on every push.

## Demo mode (no API key needed)

**Load a demo week** seeds five backdated days of one story arc — three threads
weaving through it (a launch clash that resolves, a deep-work habit forming, a
colleague's migration risks finally written up) — through the same transactional
pipeline as live runs, with zero LLM calls: instant, and works with no
`LLM_API_KEY` configured. The cross-day threads are baked to match the arc, so
the compounding payoff is visible keyless. (Single samples work too.) Tests pin
every pre-baked payload and thread to the real schemas, so drift breaks CI
instead of the demo.

To regenerate the screenshots against a throwaway DB (your real journal is
never captured):

```bash
createdb voicedebrief_demo && psql -d postgres -c "ALTER DATABASE voicedebrief_demo OWNER TO voice"
DEMO_DB='postgres://voice:voice@localhost:5432/voicedebrief_demo'
DATABASE_URL=$DEMO_DB npm run db:migrate && DATABASE_URL=$DEMO_DB npm run db:seed
DATABASE_URL=$DEMO_DB npm run dev
node scripts/demo-shots.mjs    # playwright-core + system Chrome → docs/screenshots/
```

## How it works

```
input  (typed monologue  OR  recorded voice → server transcription)
  │
  └─ strong model: Zod-validated extraction (bounded retry on schema failure)
       └─ transactional store: session + rows + tags + user_state
            └─ editable doc: edit / add / delete(+undo) / reclassify
                 └─ corrections write back  source='user', was_corrected=true

Home page: tomorrow's plan (checkable next steps) + recent entries
```

## Status & roadmap

**Done (v1):** typed + recorded-voice input with server transcription · dual-model
extraction (fast overview + strong rows) with validation/retry · editable
structured doc with write-back · next-steps plan · cross-session adaptation
(`user_state`).

**Done (Phase 1):** multi-user auth (scrypt + signed session cookies) ·
per-user data isolation end-to-end · per-user rate limits · session JSON
export + delete.

**Next:** streaming (real-time) voice · audio-file paste/upload (the live
recorder already covers every browser) · cross-day insight rollup ·
embeddings/pgvector for fuzzy thread-connection.

See [`PROGRESS.md`](PROGRESS.md) for the detailed build log.

## License

MIT © David Kieu
