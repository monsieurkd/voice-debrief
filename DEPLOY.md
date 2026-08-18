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

## When Phase 1 (auth) lands

Revisit this: with real auth + per-user limits you can add `LLM_API_KEY` and
open the live debrief path publicly. Until then, keep the key out of the
demo deployment.
