# Live demo deployment (Vercel + Neon, ~10 minutes)

A public, clickable demo of the app. The app is **chat-first**: the landing `/`
is a ChatGPT-style chat window (text + voice-in; optional voice-out via TTS).
Guests can chat immediately — their first turn mints an anonymous user, and a
session cookie/adoption keeps conversations per visitor.

## 1. Hosted Postgres (Neon free tier)

1. Sign up at [neon.tech](https://neon.tech) → **Create project** (e.g. `voice-debrief-demo`).
2. Copy the **pooled** connection string (the one on the `-pooler` host), append
   `?sslmode=require`. It looks like:
   ```
   postgresql://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

## 2. Migrate + seed the hosted DB (from this machine)

```bash
DATABASE_URL='<your-neon-pooled-url>' npm run db:migrate
DATABASE_URL='<your-neon-pooled-url>' npm run db:seed
```

(`db:seed` creates the seeded account `you@example.com` / `SEED_PASSWORD`, default
`devpassword`; on a public deploy set a strong `SEED_PASSWORD` or delete that row
after migrating: `DELETE FROM users WHERE email = 'you@example.com'`.)

## 3. Deploy on Vercel

1. Push this repo to GitHub first (if you haven't).
2. [vercel.com](https://vercel.com) → **Add New → Project** → import `voice-debrief`.
3. Environment Variables (Production + Preview):
   - `DATABASE_URL` = the same Neon pooled URL
   - `AUTH_SECRET` = a random 32-byte secret: `openssl rand -base64 32` (signs
     session + guest cookies; rotating it logs everyone out)
   - `LLM_API_KEY` + `LLM_SMALL_MODEL` (the chat provider; without it the chat
     returns a friendly "no API key" message — guests can still sign up/log in)
   - Optional: `LLM_ASR_*` (voice-in) and `LLM_TTS_MODEL` (voice-out; e.g. `tts-1`)
4. **Deploy** (the build needs no database — `/` renders dynamically).

## 4. Verify

Open the deployment URL → the chat loads → type (or record) a turn → the
assistant replies; refresh to see the conversation in the sidebar; sign up to
adopt the guest conversation.

## 5. Point the README badge at it

Replace the `#` URL in the badge line at the top of `README.md`:

```markdown
[![Live demo](https://img.shields.io/badge/live-demo-2ea44f?style=flat-square)](https://YOUR-DEMO-URL.vercel.app)
```

## 6. Reset the demo data anytime

From Neon's SQL editor (or psql): `TRUNCATE messages, conversations;` (keeps
`users` and `rate_limits`). Re-run step 2's `db:seed` if you removed the user row too.

## Providers (chat / ASR / TTS)

All three are provider-neutral and swap by env — OpenAI, Z.ai (GLM), Google
Gemini (OpenAI-compatible endpoint), OpenRouter, or a local Ollama model. The
chat uses `LLM_SMALL_MODEL` (one fast model). ASR (`LLM_ASR_*`) and
TTS (`LLM_TTS_*`) each fall back to the chat provider when their key/base are
unset, and toggle off gracefully when no model is configured.

Swapping provider later is just editing the same env vars — no code change.

## Security notes

- Every server action is a public HTTP endpoint pre-auth, so every action
  self-authorizes via `getCurrentUser` / `currentUserOrGuest`, and every query
  scopes by owner. Cross-user/foreign ids fail closed (404 / rejected write).
- Chat turns and transcription are per-user rate-limited (`chat:u:{id}` 60/h,
  `transcriptionsPerHour` 20/h) via the DB-backed `rate_limits` table.
- For a public demo, use a dedicated free-tier or capped key; consider adding
  `LLM_TTS_MODEL` only once you're OK with the TTS cost. A daily per-user spend
  budget is a known launch item (rate limits bound counts, not cost).
