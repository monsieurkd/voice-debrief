# What I Mean: Changelog for 2026-09-01

## Commit `444b42e` (pushed)

`feat(ui): complete What I Mean glass makeover: chat surface, personas, export, and CSS-scan fix`

30 files, +1475 / −483. This is the only commit made today; everything before
(`cb4a953` and earlier) was already on `origin/main`.

### What changed
- **Chat surface** (`ChatApp.tsx`, `ChatWorkspace.tsx`, `VoiceRecorder.tsx`):
  rebuilt on the deep-blue glass canvas with glassed assistant bubbles, deep-blue
  gradient user bubbles, floating composer dock, symmetric mic + send, animated
  orb "listener" avatar, auto-speak TTS, fixed New-chat button.
- **Personas** (`src/lib/personas.ts`, `chat-prompt.ts`, `chat-driver.ts`,
  `chat.ts`, `actions/chat.ts`) + DB migration `0005` (`conversations.persona`),
  surfaced as a sidebar "Voice" picker.
- **Export** (`src/lib/export.ts`, `src/app/conversations/[id]/export/route.ts`)
  + a download button on each sidebar conversation row.
- **CSS fix** (`postcss.config.mjs`): Tailwind no longer scans `.md` docs, which
  had been emitting malformed `var(...)` utilities. This fixed the `local run`
  build error.
- **DB client** (`src/db/client.ts`): pins `search_path` to `public` for
  pooled-Neon compatibility.
- **Theme** (auth pages, shell, layout, login/signup, `ui.tsx`): moved onto the
  What I Mean deep-glass tokens.
- **Tests:** 3 new suites; 55/55 green; typecheck + lint clean; prod build green.

## Push
`git push -u origin main` published `cb4a953..444b42e` to
`github.com/monsieurkd/what-i-mean`. Verified: local `main` == `origin/main`
== `444b42e`; `main` tracks `origin/main`; zero commits left unpushed.

## Also created today (not committed yet)
- `docs/progress-2026-09-01.md`: the written progress update for today.
