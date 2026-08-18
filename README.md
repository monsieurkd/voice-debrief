# Voice Debrief

> Talk (or type) through your day. A small AI interview captures it, a strong
> model turns it into **structured, queryable data**, and an editable document
> lets you correct anything — so a daily debrief compounds into a personal data
> layer you can search and act on.

**Status:** v1 is usable daily — text or a guided AI interview in → structured
data out → an editable document → a next-steps plan. Real-time voice/STT is the
next milestone.

---

## Screenshots

**A day becomes a structured, editable doc — and tomorrow's plan.**

![The structured, editable doc — every row fixable, movable, deletable](docs/screenshots/02-session-doc.png)

![Home: tomorrow's plan with check-off, plus recent entries](docs/screenshots/04-home-plan.png)

![The guided interview — small-model driver, deterministic checklist of what's covered](docs/screenshots/07-interview.png)

---

## Why

Journaling and life-management apps fail for one reason: after a long day,
typing and organizing is the last thing you'll do. A smart interview removes
the friction — but the real value isn't a faster unstructured journal. It's the
second step: **turning the verbal dump into structured data that accrues over
time.** Once that data layer exists, "a clear look at your day + your next
steps" falls out almost for free.

This project is also where I learned the part of LLM engineering that matters
most: **making LLM systems reliable enough to depend on.**

## What's non-obvious (the engineering)

- **Deterministic interview control.** A small-model driver runs a
  reflect-then-probe interview, but "am I done?" is decided by an explicit
  checklist state machine — *not* the model's self-judgment. The model reports
  which fields a turn covered; a rule decides when to stop.
- **Trustworthy extraction.** A strong model emits typed rows validated by
  **Zod** with a bounded retry loop (`json_object` mode + schema
  self-validation), so malformed output can never reach the database.
- **Model routing by stakes.** A fast model handles low-stakes fluency (the
  overview, the live interview); a strong model handles high-stakes precision
  (extraction). Routed by the *cost of being wrong*, not raw capability.
- **Human-in-the-loop data quality.** Every extracted row is editable, and each
  correction is written back (`source = user`, `was_corrected = true`), so
  extraction errors are surfaced and fixed instead of accumulating.

## Tech stack

Next.js (App Router, TypeScript, Tailwind) · PostgreSQL + Drizzle ORM · Zod ·
OpenAI-compatible LLM SDK — **bring your own key and provider.**

## Quick start (bring your own API key)

```bash
git clone https://github.com/monsieurkd/voice-debrief.git
cd voice-debrief
npm install
cp .env.example .env.local      # fill in YOUR LLM_API_KEY + provider
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

`LLM_*` vars are provider-neutral — point them at OpenAI, Z.ai (GLM), Google
Gemini (OpenAI-compatible endpoint), OpenRouter, or a local Ollama model. See
[`.env.example`](.env.example). Set `APP_TIMEZONE` (IANA name) to fix the
zone dates are interpreted and rendered in — default is the server's local
zone.

## Testing & checks

```bash
npm test          # unit tests (node:test) — deterministic, no DB or API key needed
npm run typecheck
npm run lint
npm run test:db   # DB-integration scripts — needs a migrated local Postgres
```

CI runs lint + typecheck + test + build on every push.

## Demo mode (no API key needed)

Loading a sample stores a **pre-baked extraction through the same transactional
pipeline** as a live run — real rows, tags, goals, `user_state` — with zero LLM
calls: instant, and works with no `LLM_API_KEY` configured. Due dates are built
relative to today, so samples always land in the plan window. Tests pin every
pre-baked payload to the real extraction schema, so schema drift breaks CI
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
input  (typed monologue  OR  guided interview)
  │
  ├─ small model: reflect-then-probe driver, tracks a deterministic checklist
  └─ on finish: transcript → strong model
       └─ Zod-validated extraction (bounded retry on schema failure)
            └─ transactional store: session + rows + tags + user_state
                 └─ editable doc: edit / add / delete(+undo) / reclassify
                      └─ corrections write back  source='user', was_corrected=true

Home page: tomorrow's plan (checkable next steps) + recent entries
```

## Status & roadmap

**Done (v1):** typed + guided-interview input · dual-model extraction with
validation/retry · editable structured doc with write-back · next-steps plan ·
cross-session adaptation (`user_state`).

**Next:** voice/STT (batch, then streaming) · cross-day insight rollup ·
embeddings/pgvector for fuzzy thread-connection · multi-user/auth.

See [`PROGRESS.md`](PROGRESS.md) for the detailed build log.

## License

MIT © David Kieu
