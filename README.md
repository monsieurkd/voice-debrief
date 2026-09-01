# Voice Debrief

[![Live demo](https://img.shields.io/badge/live-demo-2ea44f?style=flat-square)](#) <!-- replace # with the deployment URL — see DEPLOY.md -->
[![CI](https://img.shields.io/github/actions/workflow/status/monsieurkd/voice-debrief/ci.yml?style=flat-square)](https://github.com/monsieurkd/voice-debrief/actions/workflows/ci.yml)

> Talk it out. A warm, attentive AI voice helps you through your day — you
> speak or type, it listens, asks what matters, and speaks back. Past chats
> stay in a sidebar.

**Status:** voice-first conversational app — **voice in and out, every browser**
(tap-to-record + server transcription; the assistant replies aloud via provider
TTS). Guests chat immediately without an account; sign-up/login adopts their
conversations. Email+password auth, per-user rate limits.

---

## Why

The pitch is not "get structured data" — it's **a conversation with someone who
actually listens.** After a long day you won't type an essay; you'll *talk*. The
product is the conversation itself: a therapist/friend/assistant persona that
asks varied, interesting follow-ups, never just echoes you back, and quietly
draws out what actually mattered. The journal is whatever the conversation
produced.

This project is also where I learned the part of LLM engineering that matters
most: **making LLM systems reliable enough to depend on.**

## What's non-obvious (the engineering)

- **A persona that doesn't echo.** `src/lib/chat-prompt.ts` encodes hard
  non-negotiables: no paraphrasing the user back, varied moves (follow-up /
  reframe / naming an emotion / surfacing what was skipped), ≤1 question per
  turn, concise, depth-matched. This is the differentiator.
- **Voice you can count on.** Voice-in: the recorder transcodes to **mono
  16 kHz WAV** with a band-limited resample + power-equal downmix (no aliasing /
  phase cancellation), then a provider-neutral endpoint with **exponential
  back-off retry** so rate-limits retry instead of dropping your clip. Voice-out:
  provider TTS turns the reply into spoken audio you can replay.
- **Never lose your words.** Your message is saved *before* the model call, so
  even a model failure keeps what you said.
- **One fast model.** No large model, no JSON extraction round-trip — the reply
  is plain text from a fast model, so it's responsive. Providers (chat, ASR,
  TTS) are all swap-by-env.
- **Multi-user with self-authorizing actions.** A signed session cookie
  (scrypt passwords, JWT via jose) gates routes via `src/proxy.ts` — but every
  server action *re-checks* the user itself, and every query scopes by owner, so
  the gate is defense-in-depth, not the boundary. Cross-user ids fail closed
  (404 / rejected write), never leak data.

## Tech stack

Next.js (App Router, TypeScript, Tailwind) · PostgreSQL + Drizzle ORM · Zod ·
OpenAI-compatible LLM SDK — **bring your own key and provider** for chat, ASR,
and TTS.

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
`db:seed`).

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `AUTH_SECRET` | yes | signs session cookies — generate with `openssl rand -base64 32`; rotating it logs everyone out |
| `LLM_API_KEY` | yes | the chat provider (a fast model in `LLM_SMALL_MODEL`) |
| `LLM_BASE_URL` / `LLM_SMALL_MODEL` | no | provider-neutral (Z.ai GLM by default) |
| `LLM_ASR_*` | no | voice-in; falls back to the chat provider, model `whisper-1` |
| `LLM_TTS_MODEL` (+ `_BASE_URL`/`_API_KEY`) | no | voice-out; set a TTS model to speak replies aloud, e.g. `tts-1` |
| `SEED_PASSWORD` | no | password for the seeded account (default `devpassword`) |

Providers are swapped by env only — OpenAI, Z.ai (GLM), Google Gemini
(OpenAI-compatible endpoint), OpenRouter, or a local Ollama model. See
[`.env.example`](.env.example).

## Testing & checks

```bash
npm test          # unit tests (node:test) — deterministic, no DB or API key needed
npm run typecheck
npm run lint
npm run build     # for server-component / route / action changes
```

CI runs lint + typecheck + test + build on every push.

## How it works

```
/  (chat landing, force-dynamic)
   │
   ├─ chatTurnAction(message, conversationId?)   (server action)
   │      ├─ currentUserOrGuest()  ── mints a guest on the first turn
   │      ├─ rate-limit chat:u:{id}
   │      ├─ append the user's message FIRST (never lost)
   │      ├─ generateChatReply()   FAST model + persona → plain-text reply
   │      ├─ append reply + touch conversation + revalidate /
   │      └─ synthesizeSpeech()    TTS → audio → client speaks the reply aloud
   │
   └─ sidebar: listConversations(userId); click → load that transcript
```

See [`PROGRESS.md`](PROGRESS.md) for the detailed build log and
[`KNOWLEDGE_BASE.md`](KNOWLEDGE_BASE.md) for the project knowledge base.

## License

MIT © David Kieu
