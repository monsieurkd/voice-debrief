# What I Mean — Knowledge Base

> Session cache: loaded automatically via `CLAUDE.md` (`@KNOWLEDGE_BASE.md`).
> This is the distilled, loadable picture of the project — what it is, how it
> works, what must not be undone, and where it's going. If it drifts from
> `PROGRESS.md` (the build log), `PROGRESS.md` is the longer truth.

---

## 1. What this is

A **voice-first conversational app**. The landing page `/` is a ChatGPT-style
chat window: you talk (or type) your day and a warm **AI persona — therapist /
friend / assistant blend** — asks varied, interesting follow-ups, reframes, and
draws out what matters. Voice is the main attraction: speak via a mic (server
transcription) and the assistant **speaks back** (provider TTS). Past chats
persist in a sidebar.

The old structured-journal product (extraction → events/reflections/decisions/
next_steps rows → editable doc → plan/threads/archive) was **removed** in the
chat pivot. There is no structured extraction anymore — the goal now is
**maximising retention through a genuinely good conversation**, with the journal
being whatever the conversation produced (the transcript + a title).

**Guest-first onboarding (kept).** The chat sits in front of any auth wall. A
brand-new visitor lands on `/` and can chat immediately: their first turn mints
an anonymous **guest** user (a `users` row with `email`/`password_hash` NULL,
identified by a signed `vd_guest` cookie). When they later sign up / log in,
their guest conversations are **adopted** onto the real account
(`adoptGuestData` in `src/lib/adopt.ts`) and the guest row is deleted. Login is
a quiet pill, never a gate.

Target: multi-user SaaS. The differentiator to defend is the **AI conversation
quality** — a voice chat that feels like talking to someone who actually
listens, plus the BYOK/privacy wedge (the operator controls which provider sees
the transcript/audio).

**Voice (in + out).** Voice-in: `VoiceRecorder` (MediaRecorder, every browser)
→ transcoded to mono 16 kHz WAV (`src/lib/webm-to-wav.ts`, band-limited, no
phase-cancellation) → provider-neutral ASR (`src/lib/asr.ts`, `LLM_ASR_*`
falling back to `LLM_*`; 429-rate-limit retry) → text lands in the chat composer.
Voice-out: `src/lib/tts.ts` synthesizes the assistant's reply to WAV (`LLM_TTS_*`
falling back to the chat provider) and the client plays it, with a per-message
"hear it" replay. Both are optional via env; the chat works fine text-only.

**UI is the "Digital Sanctuary".** Meditative, glassy, low-cognitive-load
aesthetic (see `stitch_mindcloud_ai/DESIGN.md`): surface `#f7f9ff`, primary
container `#f0f8ff`, on-surface `#171c22`, `meditative-lavender` chips, font
`Playwrite DE Grund` headings + `Open Sans` body, ambient inputs, ghost loaders.
Design tokens in `src/app/globals.css` `@theme`; primitives in
`src/components/ui.tsx`; the frame is `src/components/shell.tsx`. The chat UI is
`src/components/ChatApp.tsx` (+ `ChatWorkspace.tsx` for the sidebar) — deliberate
**not card-based**: user/assistant turns flow as bubbles in one continuous view.

## 2. Verified state (2026-08-31, chat pivot)

- **35 unit tests green, typecheck + lint green, prod build green** (`npm
  test`, `npm run typecheck`, `npm run lint`, `npm run build`). No DB-integration
  suite remains (the schema slimmed to chat); `npm run test:db` was dropped.
- App routes: `/` (chat landing, force-dynamic), `/login`, `/signup`, `/error`,
  `/not-found`. `src/proxy.ts` middleware active.
- Working: auth (scrypt + jose-signed cookies, 30-day TTL), tenancy (every
  query scoped by owner, fails closed), guest mint + adoption, per-user rate
  limits, chat turns (`src/actions/chat.ts`), voice-in (`voice.ts`), voice-out
  (`tts.ts`), past-chat sidebar.

## 3. Architecture at a glance

```
/  (ChatWorkspace, force-dynamic)
   ├─ sidebar: listConversations(userId) → click loads getConversationAction
   └─ <ChatApp> (client)
        ├─ composer: <VoiceRecorder> (ASR) + text
        └─ chatTurnAction(message, conversationId?)   (src/actions/chat.ts)
             ├─ currentUserOrGuest()  ── mints guest on first turn
             ├─ rate-limit chat:u:{id}
             ├─ resolve/create conversation
             ├─ append user message FIRST (transcript never lost)
             ├─ generateChatReply(history)  ← FAST model (LLM_SMALL_MODEL) + persona
             ├─ append assistant message + touch conversation + revalidate /
             └─ synthesizeSpeech(reply)  → audio base64 → client plays aloud
```

- One fast model drives everything (chat now; extraction is gone). No large
  model, no JSON/Zod extraction round-trip — the reply is plain text.
- **The persona is the product's survival.** `src/lib/chat-prompt.ts` encodes
  non-negotiables: no echoing/paraphrasing; varied moves (follow-up / reframe /
  naming an emotion / surfacing what was skipped); ≤1 question per turn; concise;
  matches the user's depth. Do not weaken these without an explicit reason.
- **Never lose the user's words**: `appendMessage(user)` runs before the model
  call. A model failure returns a friendly message but their message is saved.

## 4. Key files map

| Area | Files |
|---|---|
| Actions (all self-authorize) | `src/actions/chat.ts` (chatTurnAction, listConversationsAction, getConversationAction), `auth.ts`, `voice.ts` (transcribeAudioAction — batch STT) |
| LLM / voice | `lib/chat-driver.ts` (generateChatReply — fast model), `lib/chat-prompt.ts` (persona), `lib/llm-client.ts`, `lib/llm-errors.ts` (friendly `summarizeLlmError`), `asr.ts` (STT + `summarizeAsrError`), `tts.ts` (voice-out), `webm-to-wav.ts` (browser mono 16k WAV transcode) |
| Data layer | `db/schema.ts`, `lib/chat.ts` (conversations + messages CRUD), `lib/constants.ts` (rate-limits) |
| Auth | `lib/auth.ts` (getCurrentUser/requireUser + getGuestId/currentUserOrGuest — the real gates), `lib/session-token.ts` (jose sign/verify for session + guest cookies), `lib/passwd.ts` (scrypt), `lib/adopt.ts` (moves a guest's conversations to a real user), `proxy.ts` (optimistic, guest-first route gate) |
| Other | `lib/rate-limit.ts` (DB-backed per-user windows), `lib/action-args.ts` (runtime Zod validation of action inputs), `lib/env.ts` (validates env at import) |
| UI | `components/ChatApp.tsx` (the chat window — the product), `components/ChatWorkspace.tsx` (sidebar + chat), `components/VoiceRecorder.tsx` (Mic → server STT), `components/ui.tsx` (Digital Sanctuary primitives: Button/GhostButton/Wordmark/Card/Field/GhostLoader/…), `components/shell.tsx` (app frame: wordmark + login pill), `LoginPill`, `LogoutButton` |

## 5. Schema quick reference (`src/db/schema.ts`)

- `users` (id, email unique, password_hash `scrypt:<salt>:<hash>`; guests have NULL email/hash)
- `conversations` — one per chat; `user_id` FK cascade; `title` (auto from first
  turn, for the sidebar); indexed `(user_id, updated_at desc)`
- `messages` — the transcript; `conversation_id` FK cascade; role `'user'`|`'assistant'`; content; indexed `(conversation_id, created_at)`
- `rate_limits` — (bucket, window_start) PK, DB-backed so serverless instances share state

Migration `0004_chat_pivot` dropped the old structured tables (sessions /
events / reflections / decisions / next_steps / goals / tags / tag_links /
insights / user_state). Migration chain is internally consistent (drizzle
reports no schema changes).

## 6. Engineering decisions you must not undo

1. **Proxy gate is optimistic only, and guest-first.** Next 16 renamed
   middleware → `proxy.ts`; it's deliberate self-contained (no DB). `/`, `/login`,
   `/signup` are reachable without identity. Every server action re-authorizes
   itself via `getCurrentUser`/`currentUserOrGuest`, and every query scopes by
   owner — cross-user/foreign ids fail closed (404/rejected write). Never rely on
   the proxy matcher as the boundary, and never move `/` behind login (it breaks
   guest-first).
2. **Server-action inputs are client-controlled HTTP payloads** — every action
   runtime-validates via `parseArgs` + Zod (bounded text, valid shapes).
3. **Failure is never silent**: config errors fail fast; the user's chat message
   is saved before the model call; `e.message` is never returned raw to clients
   (`summarizeLlmError` / `summarizeAsrError`).
4. **The chat landing is `force-dynamic`** + `revalidatePath('/')` after each
   turn so new messages + the sidebar update immediately (build-time prerender
   would hide them).
5. **Provider-neutral `LLM_*` / `LLM_ASR_*` / `LLM_TTS_*` env**: swap
   OpenAI/Z.ai/Gemini/OpenRouter/Ollama with env only — no code change. TTS and
   ASR each fall back to the main chat provider when their `*_BASE_URL`/key is
   unset; each toggles off gracefully when no model is configured.

## 7. Next step

The core chat needs validation, then launch hardening:

1. **Close the loop on conversation quality** — this is the product. Spend on
   the persona (variety, depth-matching, not-interrogation) based on real
   conversations, not guesses.
2. **Paywall-lean launch prep**: daily per-user spend budget (rate-limits bound
   counts, not cost), `/api/health`, Sentry + backup runbook, `LLM_TTS_*` wiring
   on a real voice model in `.env.local`.
3. **Billing (Stripe) only AFTER validation** — run a closed beta (privacy-
   friendly analytics + D7 retention) before building checkout; billing is pure
   overhead until someone has proven they'd pay. Legal/trust (ToS, privacy, AI
   disclosure — "your provider's LLM sees your conversation/audio") can be built
   in parallel regardless.

Open items: conversation reminders (retention), audio-file upload (the recorder
covers live input), PWA manifest. Do NOT add pgvector/embeddings yet (deferred —
not a launch blocker).
