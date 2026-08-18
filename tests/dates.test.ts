// dates.ts was the highest-bug-density, zero-coverage file in the repo — these
// tests pin the exact failure modes the 2026-08 review found:
//   1. human dates shifting a day early in any TZ east of UTC (local-midnight → UTC round trip)
//   2. "Aug 19" parsing as year 2001
//   3. date-only timestamps anchoring to the wrong midnight
//
// Set before any assertion runs; appTimezone() reads env lazily at call time.
process.env.APP_TIMEZONE = 'Asia/Ho_Chi_Minh' // UTC+7 — east of UTC, catches day shifts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDateOnly, parseTimestamp, formatDate, todayInAppTz, appTimezone } from '../src/lib/dates'

// Fixed "now" so year-anchoring tests are deterministic: 2026-08-18T04:00:00Z.
const NOW = new Date('2026-08-18T04:00:00Z')

test('parseDateOnly passes through valid ISO date-only', () => {
  assert.equal(parseDateOnly('2026-08-19'), '2026-08-19')
})

test('parseDateOnly rejects impossible calendar dates', () => {
  assert.equal(parseDateOnly('2026-02-30'), null)
  assert.equal(parseDateOnly('2026-13-01'), null)
})

test('parseDateOnly: month-name dates keep their calendar day (no UTC shift)', () => {
  // Previously: new Date("August 19, 2026") at local midnight +07 → 2026-08-18T17:00Z
  // → toISOString().slice(0,10) === '2026-08-18' — one day early.
  assert.equal(parseDateOnly('August 19, 2026', { now: NOW }), '2026-08-19')
  assert.equal(parseDateOnly('Aug 19, 2026', { now: NOW }), '2026-08-19')
  assert.equal(parseDateOnly('August 19th, 2026', { now: NOW }), '2026-08-19')
  assert.equal(parseDateOnly('19 Aug 2026', { now: NOW }), '2026-08-19')
  assert.equal(parseDateOnly('19 August 2026', { now: NOW }), '2026-08-19')
  assert.equal(parseDateOnly('Sept 1, 2026', { now: NOW }), '2026-09-01')
})

test('parseDateOnly handles YYYY/M/D', () => {
  // Previously shifted to 2026-08-18 in UTC+7.
  assert.equal(parseDateOnly('2026/08/19', { now: NOW }), '2026-08-19')
})

test('parseDateOnly anchors missing years near now (never year 2001)', () => {
  // Previously: new Date("Aug 19") → Aug 19 2001.
  assert.equal(parseDateOnly('Aug 19', { now: NOW }), '2026-08-19') // closest to 2026-08-18
  assert.equal(parseDateOnly('Aug 20', { now: NOW }), '2026-08-20')
  assert.equal(parseDateOnly('Aug 17', { now: NOW }), '2026-08-17')
})

test('parseDateOnly returns null for non-dates', () => {
  assert.equal(parseDateOnly('tomorrow'), null)
  assert.equal(parseDateOnly(''), null)
  assert.equal(parseDateOnly(null), null)
  assert.equal(parseDateOnly('19/8/2026'), null) // ambiguous numeric D/M — rejected, not guessed
})

test('parseTimestamp anchors date-only to midnight in the app timezone', () => {
  // Midnight 2026-08-19 in UTC+7 is 2026-08-18T17:00:00Z — the SAME calendar
  // day locally, not a shifted one.
  assert.equal(parseTimestamp('2026-08-19')?.toISOString(), '2026-08-18T17:00:00.000Z')
})

test('parseTimestamp keeps explicit-offset ISO instants untouched', () => {
  assert.equal(parseTimestamp('2026-08-19T10:30:00Z')?.toISOString(), '2026-08-19T10:30:00.000Z')
  assert.equal(parseTimestamp('2026-08-19T10:30:00+07:00')?.toISOString(), '2026-08-19T03:30:00.000Z')
})

test('parseTimestamp treats naive date-times as app-timezone wall clock', () => {
  assert.equal(parseTimestamp('2026-08-19T10:30')?.toISOString(), '2026-08-19T03:30:00.000Z')
})

test('parseTimestamp handles month-name forms as app-TZ midnight', () => {
  assert.equal(parseTimestamp('August 19, 2026')?.toISOString(), '2026-08-18T17:00:00.000Z')
})

test('parseTimestamp returns null for garbage', () => {
  assert.equal(parseTimestamp('whenever'), null)
  assert.equal(parseTimestamp('2026-02-30'), null)
})

test('formatDate renders in the app timezone, not the server zone', () => {
  // 2026-08-18T23:30Z is already Aug 19 in UTC+7 — the label must say Aug 19
  // even if the server runs in UTC.
  const label = formatDate(new Date('2026-08-18T23:30:00Z'), { weekday: 'short', month: 'short', day: 'numeric' })
  assert.match(label, /Aug 19/)
})

test('todayInAppTz rolls over at app-TZ midnight, not UTC midnight', () => {
  // 2026-08-18T20:00Z is 2026-08-19 03:00 in UTC+7.
  assert.equal(todayInAppTz(new Date('2026-08-18T20:00:00Z')), '2026-08-19')
  assert.equal(todayInAppTz(new Date('2026-08-18T10:00:00Z')), '2026-08-18')
})

test('appTimezone honors APP_TIMEZONE', () => {
  assert.equal(appTimezone(), 'Asia/Ho_Chi_Minh')
})
