// FT2 adversarial pass — attacks formatRelativeDay beyond the dev's own cases:
// the 6→7 cutoff exactly at midnight in odd/half-hour timezones, year-crossing
// in both directions with tz-correct years, pre-1970 and year-9999 extremes,
// DST weeks with 23.5h/25h days, the APP_TIMEZONE-vs-opts.timezone precedence,
// and the "never negative days ago" promise across tz shifts.
//
// Everything pins BOTH `now` (an exact instant) and the effective timezone.
// appTimezone() is read lazily at call time, so APP_TIMEZONE mutations inside
// tests are safe (node:test runs a file's tests sequentially); each is
// restored in a finally block.
process.env.APP_TIMEZONE = 'UTC'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatRelativeDay, parseDateOnly, appTimezone } from '../src/lib/dates'

// ---------------------------------------------------------------------------
// 6→7 cutoff exactly at midnight in the effective timezone
// ---------------------------------------------------------------------------

test('cutoff at EXACT midnight in UTC: distance 6 stays relative, 7 flips to date', () => {
  const now = new Date('2026-08-19T00:00:00.000Z') // precisely midnight UTC
  assert.equal(formatRelativeDay('2026-08-13', { now, timezone: 'UTC' }), '6 days ago')
  assert.equal(formatRelativeDay('2026-08-12', { now, timezone: 'UTC' }), 'Aug 12')
})

test('cutoff at EXACT midnight in Asia/Kathmandu (UTC+5:45): 18:15Z is 00:00 local', () => {
  const now = new Date('2026-08-19T18:15:00Z') // 2026-08-20 00:00:00 +05:45 exactly
  assert.equal(formatRelativeDay('2026-08-20', { now, timezone: 'Asia/Kathmandu' }), 'Today')
  assert.equal(formatRelativeDay('2026-08-14', { now, timezone: 'Asia/Kathmandu' }), '6 days ago')
  assert.equal(formatRelativeDay('2026-08-13', { now, timezone: 'Asia/Kathmandu' }), 'Aug 13')
})

test('one minute BEFORE midnight in Kathmandu, the same instants shift a day', () => {
  const now = new Date('2026-08-19T17:45:00Z') // 2026-08-19 23:30 +05:45
  assert.equal(formatRelativeDay('2026-08-19', { now, timezone: 'Asia/Kathmandu' }), 'Today')
  assert.equal(formatRelativeDay('2026-08-13', { now, timezone: 'Asia/Kathmandu' }), '6 days ago')
  assert.equal(formatRelativeDay('2026-08-12', { now, timezone: 'Asia/Kathmandu' }), 'Aug 12')
})

// ---------------------------------------------------------------------------
// DST weeks where naive ms-math miscounts (23h and 23.5h days)
// ---------------------------------------------------------------------------

test('30-minute DST: Lord Howe spring-forward week still counts calendar days', () => {
  // Lord Howe 2026-10-04 02:00 +10:30 → 02:30 +11:00 (23.5h day). ms-math from
  // midnight: 5d23.5h → floor 5; calendar-day counting must say 6.
  const now = new Date('2026-10-07T01:30:00Z') // 2026-10-07 12:30 +11:00
  assert.equal(formatRelativeDay('2026-10-01', { now, timezone: 'Australia/Lord_Howe' }), '6 days ago')
  assert.equal(formatRelativeDay('2026-09-30', { now, timezone: 'Australia/Lord_Howe' }), 'Sep 30')
})

test('fall-back week (25h day) in America/New_York does not shift the 6→7 cutoff', () => {
  // 2026-11-01 02:00 EDT → 01:00 EST. A 25h day must not push a 6-day-old
  // date out of the relative band or a 7-day-old one into it.
  const now = new Date('2026-11-02T05:30:00Z') // 2026-11-02 00:30 EST
  assert.equal(formatRelativeDay('2026-10-27', { now, timezone: 'America/New_York' }), '6 days ago')
  assert.equal(formatRelativeDay('2026-10-26', { now, timezone: 'America/New_York' }), 'Oct 26')
})

// ---------------------------------------------------------------------------
// Year crossing in both directions — and the tz-correct "now year"
// ---------------------------------------------------------------------------

test('early Jan in UTC: late-Dec dates stay relative inside 6 days', () => {
  const now = new Date('2027-01-01T00:30:00Z')
  assert.equal(formatRelativeDay('2026-12-31', { now, timezone: 'UTC' }), 'Yesterday')
  assert.equal(formatRelativeDay('2026-12-26', { now, timezone: 'UTC' }), '6 days ago')
  assert.equal(formatRelativeDay('2026-12-25', { now, timezone: 'UTC' }), 'Dec 25, 2026')
})

test('now-year is the EFFECTIVE-tz year: Honolulu (UTC-10) is still 2026 on Jan 1', () => {
  // 2027-01-01T00:30Z is 2026-12-31 14:30 in Honolulu → now's year is 2026,
  // so a 7-day-old date in 2026 must NOT get a year suffix.
  const now = new Date('2027-01-01T00:30:00Z')
  assert.equal(formatRelativeDay('2026-12-31', { now, timezone: 'Pacific/Honolulu' }), 'Today')
  assert.equal(formatRelativeDay('2026-12-30', { now, timezone: 'Pacific/Honolulu' }), 'Yesterday')
  assert.equal(formatRelativeDay('2026-12-25', { now, timezone: 'Pacific/Honolulu' }), '6 days ago')
  assert.equal(formatRelativeDay('2026-12-24', { now, timezone: 'Pacific/Honolulu' }), 'Dec 24')
})

test('now-year is the EFFECTIVE-tz year: Kiritimati (UTC+14) is already 2027 on Dec 31', () => {
  const now = new Date('2026-12-31T23:30:00Z') // 2027-01-01 13:30 +14:00
  assert.equal(formatRelativeDay('2027-01-01', { now, timezone: 'Pacific/Kiritimati' }), 'Today')
  assert.equal(formatRelativeDay('2026-12-31', { now, timezone: 'Pacific/Kiritimati' }), 'Yesterday')
  assert.equal(formatRelativeDay('2026-12-25', { now, timezone: 'Pacific/Kiritimati' }), 'Dec 25, 2026')
  assert.equal(formatRelativeDay('2026-12-24', { now, timezone: 'Pacific/Kiritimati' }), 'Dec 24, 2026')
})

// ---------------------------------------------------------------------------
// Pre-1970 and extreme years
// ---------------------------------------------------------------------------

test('pre-1970 dates count calendar days and render dates with the year', () => {
  const now = new Date('1970-01-05T12:00:00Z')
  assert.equal(formatRelativeDay('1970-01-05', { now, timezone: 'UTC' }), 'Today')
  assert.equal(formatRelativeDay('1969-12-31', { now, timezone: 'UTC' }), '5 days ago')
  assert.equal(formatRelativeDay('1969-12-30', { now, timezone: 'UTC' }), '6 days ago')
  assert.equal(formatRelativeDay('1969-12-29', { now, timezone: 'UTC' }), 'Dec 29, 1969')
})

test('pre-1970 calendar day is per-TZ history: Saigon was UTC+8 in 1969', () => {
  // 1969-12-31T17:00Z is already 1970-01-01 01:00 in Asia/Ho_Chi_Minh (UTC+8
  // back then), so Dec 31 was YESTERDAY there — a UTC-naive view would say
  // "Today" (still Dec 31 in UTC).
  const now = new Date('1969-12-31T17:00:00Z')
  assert.equal(formatRelativeDay('1969-12-31', { now, timezone: 'Asia/Ho_Chi_Minh' }), 'Yesterday')
  assert.equal(formatRelativeDay('1969-12-25', { now, timezone: 'Asia/Ho_Chi_Minh' }), 'Dec 25, 1969')
})

test('year 9999 is a valid extreme; 5-digit years are out of shape', () => {
  const now = new Date('9999-12-31T12:00:00Z')
  assert.equal(formatRelativeDay('9999-12-31', { now, timezone: 'UTC' }), 'Today')
  assert.equal(formatRelativeDay('9999-12-25', { now, timezone: 'UTC' }), '6 days ago')
  assert.equal(formatRelativeDay('9999-12-24', { now, timezone: 'UTC' }), 'Dec 24')
  assert.equal(formatRelativeDay('10000-01-01', { now, timezone: 'UTC' }), null)
})

test('year 0000 and 0099 are rejected exactly as parseDateOnly rejects them', () => {
  const now = new Date('2026-08-19T12:00:00Z')
  assert.equal(parseDateOnly('0000-01-01'), null)
  assert.equal(formatRelativeDay('0000-01-01', { now, timezone: 'UTC' }), null)
  assert.equal(parseDateOnly('0099-01-01'), null)
  assert.equal(formatRelativeDay('0099-01-01', { now, timezone: 'UTC' }), null)
})

// ---------------------------------------------------------------------------
// The "never negative days ago" promise across tz shifts
// ---------------------------------------------------------------------------

test('a date one day in the future across a tz shift is a date, never "-1 days ago"', () => {
  const now = new Date('2026-08-19T20:30:00Z') // Hanoi is already Aug 20
  const label = formatRelativeDay('2026-08-21', { now, timezone: 'Asia/Ho_Chi_Minh' })
  assert.equal(label, 'Aug 21')
  assert.doesNotMatch(String(label), /ago/)
})

test('exactly 7 days in the future is still a date label (cutoff is one-sided)', () => {
  const now = new Date('2026-08-19T12:00:00Z')
  assert.equal(formatRelativeDay('2026-08-26', { now, timezone: 'UTC' }), 'Aug 26')
  assert.equal(formatRelativeDay('2027-08-19', { now, timezone: 'UTC' }), 'Aug 19, 2027')
})

// ---------------------------------------------------------------------------
// APP_TIMEZONE default vs opts.timezone override
// ---------------------------------------------------------------------------

test('APP_TIMEZONE is the default when opts.timezone is omitted', () => {
  const prev = process.env.APP_TIMEZONE
  try {
    process.env.APP_TIMEZONE = 'America/New_York'
    const now = new Date('2026-08-19T20:30:00Z') // 16:30 EDT, still Aug 19
    assert.equal(appTimezone(), 'America/New_York')
    assert.equal(formatRelativeDay('2026-08-19', { now }), 'Today')
    assert.equal(formatRelativeDay('2026-08-12', { now }), 'Aug 12')
  } finally {
    process.env.APP_TIMEZONE = prev
  }
})

test('opts.timezone wins over APP_TIMEZONE for the same call', () => {
  const prev = process.env.APP_TIMEZONE
  try {
    process.env.APP_TIMEZONE = 'America/New_York'
    const now = new Date('2026-08-19T20:30:00Z')
    // Env says Aug 19; Hanoi (opts) already says Aug 20 → the opt must win.
    assert.equal(formatRelativeDay('2026-08-19', { now, timezone: 'Asia/Ho_Chi_Minh' }), 'Yesterday')
    assert.equal(formatRelativeDay('2026-08-20', { now, timezone: 'Asia/Ho_Chi_Minh' }), 'Today')
  } finally {
    process.env.APP_TIMEZONE = prev
  }
})

test('year suffix follows the effective tz even when env and opt disagree', () => {
  // Env = UTC (Dec 31 2026), opt = Kiritimati (already Jan 1 2027): the
  // 7-day-old Dec 25 is in a DIFFERENT year than now-in-Kiritimati → suffix.
  const now = new Date('2026-12-31T23:30:00Z')
  assert.equal(formatRelativeDay('2026-12-25', { now, timezone: 'Pacific/Kiritimati' }), 'Dec 25, 2026')
  // Same instant, distance measured in UTC (today = Dec 31 2026): the 7-day-
  // old date Dec 24 is in the SAME year → no suffix.
  assert.equal(formatRelativeDay('2026-12-24', { now, timezone: 'UTC' }), 'Dec 24')
})

// ---------------------------------------------------------------------------
// Calendar edge cases: leap day, month ends, last millisecond of the day
// ---------------------------------------------------------------------------

test('leap day: Feb 29 stays on its calendar day, neighbors count exactly', () => {
  const now = new Date('2024-02-29T12:00:00Z')
  assert.equal(formatRelativeDay('2024-02-29', { now, timezone: 'UTC' }), 'Today')
  assert.equal(formatRelativeDay('2024-02-23', { now, timezone: 'UTC' }), '6 days ago')
  assert.equal(formatRelativeDay('2024-02-22', { now, timezone: 'UTC' }), 'Feb 22')
  assert.equal(formatRelativeDay('2023-02-28', { now, timezone: 'UTC' }), 'Feb 28, 2023')
})

test('month-end crossing: cutoff unaffected by shorter February', () => {
  const now = new Date('2026-03-01T12:00:00Z')
  assert.equal(formatRelativeDay('2026-02-23', { now, timezone: 'UTC' }), '6 days ago')
  assert.equal(formatRelativeDay('2026-02-22', { now, timezone: 'UTC' }), 'Feb 22')
})

test('last millisecond before midnight is still the same calendar day', () => {
  const now = new Date('2026-08-19T23:59:59.999Z')
  assert.equal(formatRelativeDay('2026-08-19', { now, timezone: 'UTC' }), 'Today')
  assert.equal(formatRelativeDay('2026-08-13', { now, timezone: 'UTC' }), '6 days ago')
  assert.equal(formatRelativeDay('2026-08-12', { now, timezone: 'UTC' }), 'Aug 12')
})

// ---------------------------------------------------------------------------
// Shape strictness beyond the dev's cases
// ---------------------------------------------------------------------------

test('datetime shapes, slash dates and garbage months/days are null', () => {
  const now = new Date('2026-08-19T12:00:00Z')
  assert.equal(formatRelativeDay('2026-08-19T10:00:00Z', { now, timezone: 'UTC' }), null)
  assert.equal(formatRelativeDay('2026/08/19', { now, timezone: 'UTC' }), null)
  assert.equal(formatRelativeDay('2026-13-01', { now, timezone: 'UTC' }), null)
  assert.equal(formatRelativeDay('2026-01-00', { now, timezone: 'UTC' }), null)
  assert.equal(formatRelativeDay('2026-00-10', { now, timezone: 'UTC' }), null)
  assert.equal(formatRelativeDay('2026-1-32', { now, timezone: 'UTC' }), null)
  assert.equal(formatRelativeDay('2026-02-29', { now, timezone: 'UTC' }), null) // non-leap
})

test('whitespace padding is tolerated around the ISO date', () => {
  const now = new Date('2026-08-19T12:00:00Z')
  assert.equal(formatRelativeDay('  2026-08-19  ', { now, timezone: 'UTC' }), 'Today')
  assert.equal(formatRelativeDay('2026-08-19\n', { now, timezone: 'UTC' }), 'Today')
})
