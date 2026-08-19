# Live demo deployment (Vercel + Neon, ~10 minutes)

A public, clickable demo of the app — **safe to run before auth exists**
because the demo deploy is configured **without `LLM_API_KEY`**:

- The **instant sample** path stores pre-baked extractions through the same
  transactional pipeline as a live run — it makes zero LLM calls, so there is
  no key to abuse and nothing that can cost money.
- Live debriefs and the guided interview fail fast with a clear
  "LLM_API_KEY is not set — nothing was saved" message.
- The worst case is someone spamming samples into the throwaway demo
  database, which you can reset in one command (step 6).

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

## 3. Deploy on Vercel

1. Push this repo to GitHub first (if you haven't).
2. [vercel.com](https://vercel.com) → **Add New → Project** → import `voice-debrief`.
3. Environment Variables (Production + Preview):
   - `DATABASE_URL` = the same Neon pooled URL
   - `APP_TIMEZONE` = e.g. `Asia/Ho_Chi_Minh` (dates render in this zone)
   - **Do NOT add `LLM_API_KEY`** — that's what makes the demo safe.
4. **Deploy** (the build needs no database — Home renders dynamically).

## 4. Verify

Open the deployment URL → Home → **load a sample** → the structured doc
appears instantly → edit a row → check off a plan item on Home.

## 5. Point the README badge at it

Replace the `#` URL in the badge line at the top of `README.md`:

```markdown
[![Live demo](https://img.shields.io/badge/live-demo-2ea44f?style=flat-square)](https://YOUR-DEMO-URL.vercel.app)
```

## 6. Reset the demo data anytime

From Neon's SQL editor (or psql): `DELETE FROM sessions;` then re-run step 2's
`db:seed` if you removed the user row too.

## Enabling the live AI path (comprehensive demo)

The keyless deploy only allows instant samples. To let visitors run **real**
debriefs and the guided interview, add an LLM key — but the key choice is the
whole security story pre-auth, because every server action is a public HTTP
endpoint:

- **Use a dedicated free-tier key** (Google AI Studio). Provider-side rate caps
  bound the worst case at ~$0. Never expose a paid key (e.g. the Z.ai plan) —
  there is no provider ceiling and no auth yet.
- **Keep the rate limits** already built in: per-IP fixed windows on
  `runDebrief` (5/hour), `interviewTurnAction` (20/hour), and samples
  (30/hour), shared across serverless instances via the `rate_limits` table.

**To add or swap the key at any time** (this is the "easy edit" — there is no
in-app key editor on purpose: pre-auth, anyone on the internet could point the
demo at an arbitrary key):

1. Vercel → your project → **Settings → Environment Variables**.
2. Set (Production + Preview):

   | Variable | Value |
   |---|---|
   | `LLM_API_KEY` | your dedicated free-tier key |
   | `LLM_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` |
   | `LLM_MODEL` | `gemini-3.5-flash` |
   | `LLM_SMALL_MODEL` | `gemini-3.1-flash-lite` |

3. **Deployments → … → Redeploy** (env changes need a redeploy).
   Swapping provider later (OpenRouter, OpenAI, Z.ai, Ollama) is the same
   three vars — the code is provider-neutral.

## When Phase 1 (auth) lands

Revisit this: with real auth + per-user limits you can add a paid key and
open the live path without the demo guardrails.

> **Update (Phase 1, auth + tenancy):** this has landed. The app now requires
> an account — anonymous visitors are redirected to `/signup`. Required env
> additions for any deploy (demo included):
>
> | Variable | Value |
> |---|---|
> | `AUTH_SECRET` | a random 32-byte secret: `openssl rand -base64 32` — signs session cookies; rotating it logs everyone out |
>
> The seeded account (`you@example.com` / `SEED_PASSWORD`, default
> `devpassword`) still exists after `db:seed`; on a public deploy either set a
> strong `SEED_PASSWORD` or delete that row after migrating (`DELETE FROM users
> WHERE email = 'you@example.com'`). Per-user spend windows (5 debriefs / 20
> interview turns / 30 samples per hour) now key on the signed-in user, so a
> paid `LLM_API_KEY` is no longer an all-you-can-eat endpoint — still use a
> capped key until per-user daily budgets land.
