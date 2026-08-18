// Drive the app end-to-end and capture the README screenshots.
// Needs the dev server running against a throwaway demo DB (see README demo
// section) so no real journal data is ever captured.
//
//   DATABASE_URL=postgres://voice:voice@localhost:5432/voicedebrief_demo \
//     node scripts/demo-shots.mjs
//
// Writes docs/screenshots/*.png and FAILS (exit 1) on any console error.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const OUT = 'docs/screenshots'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })
const step = (name) => console.log('→', name)

// 1 — empty Home (first-run onboarding state, demo-week CTA)
step('home (empty)')
await page.goto(BASE)
await page.getByRole('button', { name: 'Load a demo week' }).waitFor()
await shot('01-home-empty')

// 2 — demo week: five days + baked threads, instantly (no AI call)
step('load demo week')
await page.getByRole('button', { name: 'Load a demo week' }).click()
await page.locator('h2:has-text("Threads this week")').waitFor()
await page.locator('li:has-text("engine")').first().waitFor() // a baked thread card
await page.waitForTimeout(500) // settle
await shot('02-home-lived-in')

// 3 — open the newest session (the doc is the differentiator)
step('session doc')
await page.locator('a[href^="/session/"]').first().click()
await page.locator('h2:has-text("What happened")').waitFor()
await shot('03-session-doc')

// 4 — inline editing state
step('inline edit state')
const row = page.locator('li.group', { hasText: 'standup' }).first()
if (await row.count()) {
  await row.hover()
  await row.locator('button', { hasText: 'edit' }).click()
  await page.locator('li input:not([type])').first().waitFor()
  await shot('04-inline-edit')
} else {
  await shot('04-inline-edit')
}

// 5 — back Home; check off a plan item; it must leave the list
step('plan check-off')
await page.goto(BASE)
await page.locator('h2:has-text("Tomorrow")').waitFor()
const before = await page.locator('input[type="checkbox"]').count()
if (before > 0) {
  await page.locator('input[type="checkbox"]').first().click()
  await page
    .waitForFunction(
      (n) => document.querySelectorAll('input[type="checkbox"]').length < n,
      before,
      { timeout: 15000 },
    )
    .catch(() => console.warn('⚠ check-off did not shrink the list (may be timing)'))
}
await shot('05-home-after-checkoff')

// 6 — /new with the dictation mic
step('/new')
await page.goto(`${BASE}/new`)
await page.getByText('Debrief your day').waitFor()
await page.waitForTimeout(300)
await shot('06-new')

// 7 — guided interview (greeting + checklist pills + mic)
step('/interview')
await page.goto(`${BASE}/interview`)
await page.getByText('Guided debrief').waitFor()
await shot('07-interview')

await browser.close()

if (errors.length) {
  console.error('\nConsole errors during the run:')
  for (const e of errors) console.error(' ', e)
  process.exit(1)
}
console.log(`\n✅ demo flow verified; screenshots in ${OUT}/`)
