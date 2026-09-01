<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Prompt discipline (v2 — apply on every task)

Follow the ready-to-copy prompt templates and the **required Verify block** in
`PROMPTS.md`: state Scope / Don't / "Done when" (`[one measurable outcome]`),
then run the Verify block (`npm run typecheck && npm run lint && npm test`;
`npm run build` for server-component/route changes; capture a screenshot for
UI screens). A change is only complete once that verification runs and
reports its actual result. If something can't run, say why rather than claim
a pass.
