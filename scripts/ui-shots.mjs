#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ui-shots.mjs — capture the product's key screens for the UI-QA judge.
//
//   npm run ui:shots                # needs the dev server running
//   UI_BASE_URL=http://localhost:3000 npm run ui:shots
//   npm run ui:shots -- --filter=home,login
//
// Writes .ui-shots/<name>-<width>.png + .ui-shots/manifest.json (gitignored).
// Uses the system Google Chrome via playwright-core — no browser download.
// Exit code 1 if a screen can't load or times out (so CI could gate on it).
//
// Why some screens carry a guest cookie: the app's public-in-front design lets
// an anonymous visitor reach /, /login, /signup. The 404 page is only shown to
// a *known* visitor (a real session or guest cookie) hitting an unknown path —
// so capturing it mints a throwaway guest token and attaches it, exactly as a
// first-time visitor who chats then wanders to a dead link would.
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright-core'
import { SignJWT } from 'jose'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import dotenv from 'dotenv'

// Load .env.local so AUTH_SECRET (guest cookie) is available without shell
// setup — matches docs/ui-qa-loop.md. Explicit .env `path` (ui-judge does the
// same) so cwd never matters.
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env.local') })

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, '.ui-shots')
const BASE = process.env.UI_BASE_URL ?? 'http://localhost:3000'
const CHROME_PATH =
  process.env.CHROME_PATH ??
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : '/usr/bin/google-chrome')

// The screens the loop owns. `wait` proves the page hydrated and reached its
// intended state before the shot. Add screens here (and a one-line "what this
// screen is" to SCREEN_GUIDE in ui-judge.mjs).
const text = (t, { exact = false } = {}) => (page) =>
  page.getByText(t, { exact }).first().waitFor({ state: 'visible', timeout: 15_000 })

const SHOTS = [
  {
    name: 'home',
    path: '/',
    // the empty-greeting card — guest-first landing
    wait: text('What is Voyo?', { exact: true }),
  },
  {
    name: 'login',
    path: '/login',
    wait: (page) => page.locator('form').first().waitFor({ state: 'visible', timeout: 15_000 }),
  },
  {
    name: 'signup',
    path: '/signup',
    wait: (page) => page.locator('form').first().waitFor({ state: 'visible', timeout: 15_000 }),
  },
  {
    name: 'notfound',
    path: '/authed-but-no-such-page-xyz',
    wait: text("That page isn't here"),
    // The proxy only serves the 404 to a signed-in/guest visitor; a guest
    // cookie (signed with the app's AUTH_SECRET) satisfies it with no DB hit.
    guestCookie: true,
  },
]

// Desktop first (where the app shell + sidebar are visible), then the mobile
// viewport the past-conversation sidebar collapses away from.
const VIEWPORTS = [
  { width: 1280, height: 800, label: 'desktop' },
  { width: 390, height: 844, label: 'mobile' },
]

function parseFilter() {
  const flag = process.argv.indexOf('--filter')
  if (flag === -1) return null
  const value = process.argv[flag + 1]
  if (!value) return null
  return new Set(value.split(',').map((s) => s.trim()).filter(Boolean))
}

// Mint a signed guest token (vd_guest) so proxy.ts lets an anonymous browser
// reach the 404. Needs the app's AUTH_SECRET; shape/signing mirrors
// src/lib/session-token.ts (guest:true claim, HS256, SESSION_ISSUER).
async function guestCookie() {
  return new SignJWT({ guest: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('1') // the proxy never checks the id against the DB for the 404
    .setIssuedAt()
    .setIssuer('voice-debrief')
    .setExpirationTime('1d')
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET ?? ''))
}

async function main() {
  if (!existsSync(CHROME_PATH)) {
    console.error(`ui-shots: Chrome not found at ${CHROME_PATH}`)
    console.error('  Set CHROME_PATH, or install playwright chromium and switch this')
    console.error('  script to chromium.launch() (npm i -D playwright && npx playwright install chromium).')
    process.exit(1)
  }
  const filter = parseFilter()
  const wanted = SHOTS.filter((s) => !filter || filter.has(s.name))
  if (wanted.length === 0) {
    console.error(`ui-shots: --filter matched nothing. Known screens: ${SHOTS.map((s) => s.name).join(', ')}`)
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })
  const manifest = []
  let failed = false

  for (const screen of wanted) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
      const page = await context.newPage()
      const consoleErrors = []
      page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
      page.on('pageerror', (e) => consoleErrors.push(String(e)))

      if (screen.guestCookie) {
        if (!process.env.AUTH_SECRET) {
          console.error(`ui-shots: "${screen.name}" needs a guest cookie but AUTH_SECRET is not set in .env.local.`)
          process.exit(1)
        }
        await context.addCookies([
          {
            name: 'vd_guest',
            value: await guestCookie(),
            domain: new URL(BASE).hostname,
            httpOnly: true,
            path: '/',
          },
        ])
      }

      const file = `${screen.name}-${vp.width}.png`
      const filePath = path.join(OUT_DIR, file)
      const url = `${BASE}${screen.path}`
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 })
        await screen.wait(page)
        await page.waitForTimeout(400) // let entry animations + hydration settle
        await page.screenshot({ path: filePath })
        manifest.push({ name: screen.name, width: vp.width, file, path: screen.path })
        // A notfound screen legitimately logs a "404 (Not Found)" for the
        // document request — that is the point, not a regression. Report real
        // errors (uncaught exceptions, failing resources) otherwise.
        const realErrors = consoleErrors.filter((e) =>
          screen.name === 'notfound' ? !e.includes('404') : true,
        )
        const errors = realErrors.length > 0 ? ` — ${realErrors.length} console error(s)` : ''
        console.log(`✓ ${file} (${vp.width}x${vp.height})${errors}`)
      } catch (err) {
        failed = true
        console.error(`✗ ${file} FAILED: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        await context.close()
      }
    }
  }

  writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  await browser.close()
  console.log(`\nShots → ${OUT_DIR}/ (${manifest.length} captured)`)
  if (failed) {
    console.error('ui-shots: one or more screens failed — fix before judging.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('ui-shots:', err)
  process.exit(1)
})
