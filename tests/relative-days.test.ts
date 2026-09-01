// FT2 — formatRelativeDay. Every test pins BOTH `now` (an exact instant) and
// the timezone, so nothing here depends on the machine's local zone or on the
// actual wall-clock time. Cases mirror SPEC.md: same instant near midnight
// must label differently in UTC vs UTC+7, the 6→7 cutoff, future dates, bad
// input, year boundaries, and a DST week where ms math miscounts.
process.env.APP_TIMEZONE = 'UTC' // deterministic default; every call still passes timezone explicitly

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatRelativeDay } from '../src/lib/dates'

// 2026-08-19 20:30 UTC — already 2026-08-20 03:30 in UTC+7, so the calendar
// day differs between the two zones under test at this instant.
const NEAR_MIDNIGHT = new Date('2026-08-19T20:30:00Z')

test('today and yesterday in UTC near midnight', () => {
  assert.equal(formatRelativeDay('2026-08-19', { now: NEAR_MIDNIGHT, timezone: 'UTC' }), 'Today')
  assert.equal(formatRelativeDay('2026-08-18', { now: NEAR_MIDNIGHT, timezone: 'UTC' }), 'Yesterday')
})

test('same instant in Asia/Ho_Chi_Minh (UTC+7) has already rolled over', () => {
  // It is Aug 20 in Hanoi while UTC is still on Aug 19.
  assert.equal(formatRelativeDay('2026-08-20', { now: NEAR_MIDNIGHT, timezone: 'Asia/Ho_Chi_Minh' }), 'Today')
  assert.equal(formatRelativeDay('2026-08-19', { now: NEAR_MIDNIGHT, timezone: 'Asia/Ho_Chi_Minh' }), 'Yesterday')
})

test('the same ISO date gets different labels per timezone', () => {
  assert.equal(formatRelativeDay('2026-08-19', { now: NEAR_MIDNIGHT, timezone: 'UTC' }), 'Today')
  assert.equal(formatRelativeDay('2026-08-19', { now: NEAR_MIDNIGHT, timezone: 'Asia/Ho_Chi_Minh' }), 'Yesterday')
})

test('distances 2 and 6 stay relative', () => {
  const now = new Date('2026-08-19T12:00:00Z')
  assert.equal(formatRelativeDay('2026-08-17', { now, timezone: 'UTC' }), '2 days ago')
  assert.equal(formatRelativeDay('2026-08-13', { now, timezone: 'UTC' }), '6 days ago')
})

test('distance 7 is the cutoff to a plain date (no year when same year)', () => {
  const now = new Date('2026-08-19T12:00:00Z')
  assert.equal(formatRelativeDay('2026-08-12', { now, timezone: 'UTC' }), 'Aug 12')
})

test('a future date renders as a date, never "-1 days ago"', () => {
  const now = new Date('2026-08-19T12:00:00Z')
  const label = formatRelativeDay('2026-08-20', { now, timezone: 'UTC' })
  assert.equal(label, 'Aug 20')
  assert.doesNotMatch(String(label), /ago/)
})

test('invalid input returns null (consistent with parseDateOnly)', () => {
  assert.equal(formatRelativeDay('2026-02-30', { now: NEAR_MIDNIGHT, timezone: 'UTC' }), null)
  assert.equal(formatRelativeDay('not-a-date', { now: NEAR_MIDNIGHT, timezone: 'UTC' }), null)
  assert.equal(formatRelativeDay('', { now: NEAR_MIDNIGHT, timezone: 'UTC' }), null)
  assert.equal(formatRelativeDay(null, { now: NEAR_MIDNIGHT, timezone: 'UTC' }), null)
  assert.equal(formatRelativeDay(undefined, { now: NEAR_MIDNIGHT, timezone: 'UTC' }), null)
})

test('year boundary: within a week across New Year stays relative', () => {
  const now = new Date('2027-01-02T12:00:00Z')
  assert.equal(formatRelativeDay('2026-12-28', { now, timezone: 'UTC' }), '5 days ago')
})

test('year boundary: older than a week appends the year', () => {
  const now = new Date('2027-01-02T12:00:00Z')
  assert.equal(formatRelativeDay('2026-12-20', { now, timezone: 'UTC' }), 'Dec 20, 2026')
})

test('year boundary: a future date in the next year appends the year', () => {
  const now = new Date('2026-12-30T12:00:00Z')
  assert.equal(formatRelativeDay('2027-01-03', { now, timezone: 'UTC' }), 'Jan 3, 2027')
})

test('DST spring-forward week counts calendar days, not 24h slices (America/New_York)', () => {
  // US spring-forward 2026: 2026-03-08 02:00 EST → EDT, so that week is 1h
  // short. Midnight-instant ms math floors 5d23h to 5 and prints
  // "5 days ago"; calendar-day counting must still say 6.
  const now = new Date('2026-03-11T16:00:00Z') // 2026-03-11 12:00 EDT
  assert.equal(formatRelativeDay('2026-03-11', { now, timezone: 'America/New_York' }), 'Today')
  assert.equal(formatRelativeDay('2026-03-05', { now, timezone: 'America/New_York' }), '6 days ago')
  assert.equal(formatRelativeDay('2026-03-04', { now, timezone: 'America/New_York' }), 'Mar 4')
})
