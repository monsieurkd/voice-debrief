// Lenient parsing of the free-form date strings the model may emit — but ONLY
// via explicit formats. Never round-trip a human date through
// `new Date(s)` + `toISOString()`: that interprets the string in the server's
// timezone and re-labels it in UTC, shifting the calendar day for any TZ east
// of UTC ("August 19, 2026" → stored as 2026-08-18 in UTC+7).
//
// All calendar math here is timezone-free (Date.UTC); timestamps anchor to the
// app timezone (APP_TIMEZONE, default = server's local zone) so dates render
// consistently regardless of where the server runs.

const MONTHS: Record<string, number> = (() => {
  const names = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ]
  const m: Record<string, number> = {}
  names.forEach((n, i) => {
    m[n] = i + 1
    m[n.slice(0, 3)] = i + 1
  })
  m.sept = 9
  return m
})()

/** The timezone dates are interpreted and rendered in. Set APP_TIMEZONE to override. */
export function appTimezone(): string {
  return process.env.APP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function validYmd(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false
  const utc = new Date(Date.UTC(y, mo - 1, d))
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === mo - 1 && utc.getUTCDate() === d
}

function ymd(y: number, mo: number, d: number): string {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// "Aug 19", "August 19, 2026", "19 Aug 2026", "Aug 19th" — anchored to the
// nearest of [now-1y .. now+1y] when no year is given.
function parseMonthName(s: string, now: Date): { y: number; mo: number; d: number } | null {
  let m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?$/)
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()]
    if (!mo) return null
    return { y: m[3] ? +m[3] : anchorYear(mo, +m[2], now), mo, d: +m[2] }
  }
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s*(\d{4})?$/)
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()]
    if (!mo) return null
    return { y: m[3] ? +m[3] : anchorYear(mo, +m[1], now), mo, d: +m[1] }
  }
  return null
}

function anchorYear(mo: number, d: number, now: Date): number {
  // Pick the candidate year whose date is closest to `now` (covers "Aug 19"
  // said in either hemisphere of the year without guessing past/future).
  let best = now.getUTCFullYear()
  let bestDiff = Infinity
  for (const y of [now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1]) {
    if (!validYmd(y, mo, d)) continue
    const diff = Math.abs(Date.UTC(y, mo - 1, d) - now.getTime())
    if (diff < bestDiff) {
      best = y
      bestDiff = diff
    }
  }
  return best
}

/** Free-form model date → 'YYYY-MM-DD' (or null). Date-only semantics, no timezone. */
export function parseDateOnly(s?: string | null, opts: { now?: Date } = {}): string | null {
  if (!s) return null
  const t = s.trim()

  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return validYmd(+m[1], +m[2], +m[3]) ? ymd(+m[1], +m[2], +m[3]) : null

  m = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (m && validYmd(+m[1], +m[2], +m[3])) return ymd(+m[1], +m[2], +m[3])

  const mn = parseMonthName(t, opts.now ?? new Date())
  if (mn && validYmd(mn.y, mn.mo, mn.d)) return ymd(mn.y, mn.mo, mn.d)

  return null
}

/** Offset (ms) of `tz` at the given instant — via an Intl round-trip, no deps. */
function tzOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - instant.getTime()
}

/** A wall-clock time in `tz` → the matching UTC instant (DST-safe, two-pass). */
function zonedTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const off = tzOffsetMs(new Date(guess), tz)
  const off2 = tzOffsetMs(new Date(guess - off), tz)
  return new Date(guess - off2)
}

/**
 * Free-form model datetime → instant. Date-only strings mean midnight in the
 * app timezone (not UTC, not the server zone). Unambiguous ISO strings with an
 * explicit offset pass through untouched.
 */
export function parseTimestamp(s?: string | null): Date | null {
  if (!s) return null
  const t = s.trim()

  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/)
  if (iso) {
    const [, ys, mos, ds, hs, mins] = iso
    const y = +ys
    const mo = +mos
    const d = +ds
    if (!validYmd(y, mo, d)) return null
    if (hs === undefined) return zonedTimeToUtc(y, mo, d, 0, 0, appTimezone())
    const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(t)
    if (hasOffset) {
      const dt = new Date(t.includes(' ') && !t.includes('T') ? t.replace(' ', 'T') : t)
      return Number.isNaN(dt.getTime()) ? null : dt
    }
    return zonedTimeToUtc(y, mo, d, +hs, +mins, appTimezone())
  }

  // Month-name forms → midnight in the app timezone.
  const mn = parseMonthName(t, new Date())
  if (mn && validYmd(mn.y, mn.mo, mn.d)) return zonedTimeToUtc(mn.y, mn.mo, mn.d, 0, 0, appTimezone())

  return null
}

/** Format an instant in the app timezone (server TZ never leaks into labels). */
export function formatDate(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: appTimezone(), ...opts }).format(d)
}

/** Today's 'YYYY-MM-DD' in the app timezone. */
export function todayInAppTz(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: appTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Any instant → 'YYYY-MM-DD' in the app timezone (parts-based, DST-safe).
 *  Corollary of todayInAppTz that is not pinned to "now", so callers can
 *  feed formatRelativeDay the calendar day of an arbitrary started_at. */
export function isoDateInAppTz(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: appTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Calendar-day arithmetic on 'YYYY-MM-DD' strings (timezone-free). */
export function isoMinusDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10)
}

/** Calendar Y-M-D of an instant in `tz` (parts-based, never ms math). */
function ymdInTz(instant: Date, tz: string): { y: number; mo: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  return { y: get('year'), mo: get('month'), d: get('day') }
}

/**
 * _Date label_ / _app timezone_ / _DST-safe_ (3/5) — compact relative label:
 * 'YYYY-MM-DD' → "Today" / "Yesterday" / "N days ago" (2–6 days), or a plain
 * calendar date ("Aug 12", plus ", 2025" when the year differs from now's)
 * once the date is a week old or in the future.
 *
 * Day distance is counted calendar-day-wise, NEVER by subtracting millisecond
 * instants — DST days are 23/25h and midnight boundaries shift, so ms math
 * miscounts across a transition. Both calendar dates are reduced to UTC day
 * numbers (timezone-free, like isoMinusDays); their difference is exact.
 *
 * The input is a date-only 'YYYY-MM-DD' string, so callers that hold an
 * instant should convert it with todayInAppTz's parts-based logic or, when
 * the instant may differ from "now" in timezone, derive it explicitly.
 *
 * Timezone resolution, innermost wins: opts.timezone for this call, else the
 * app-wide appTimezone() (APP_TIMEZONE env, else the server's zone).
 * opts.now pins "now" (tests, previews); default is the current instant.
 */
export function formatRelativeDay(
  iso?: string | null,
  opts: { now?: Date; timezone?: string } = {},
): string | null {
  const m = (iso ?? '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m || !validYmd(+m[1], +m[2], +m[3])) return null

  const today = ymdInTz(opts.now ?? new Date(), opts.timezone ?? appTimezone())
  const dayNum = (y: number, mo: number, d: number) => Date.UTC(y, mo - 1, d) / 86400000
  const distance = dayNum(today.y, today.mo, today.d) - dayNum(+m[1], +m[2], +m[3])

  if (distance === 0) return 'Today'
  if (distance === 1) return 'Yesterday'
  if (distance >= 2 && distance <= 6) return `${distance} days ago`

  // A week or more old, or any future date: the calendar date itself, via
  // formatDate. It renders in the app timezone, so anchor at noon there —
  // noon is DST-safe in every zone and keeps the label on this calendar day
  // even when distance was measured in an overriding opts.timezone.
  const date = formatDate(zonedTimeToUtc(+m[1], +m[2], +m[3], 12, 0, appTimezone()), {
    month: 'short',
    day: 'numeric',
  })
  return +m[1] === today.y ? date : `${date}, ${m[1]}`
}
