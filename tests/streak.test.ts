// Streak math runs on calendar days in the APP timezone — same fixed-now
// pattern as dates.test.ts. APP_TIMEZONE is UTC+7, so instants late in the
// UTC day already belong to the next app-TZ day (the classic off-by-one).
process.env.APP_TIMEZONE = 'Asia/Ho_Chi_Minh'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStreak } from '../src/lib/streak'

// 2026-08-18T20:00:00Z is 2026-08-19 03:00 in UTC+7 → "today" is Aug 19.
const NOW = new Date('2026-08-18T20:00:00Z')
// 2026-08-18T10:00:00Z is still 2026-08-18 in UTC+7.
const NOW_SAME_UTC_DAY = new Date('2026-08-18T10:00:00Z')

test('counts consecutive days ending today', () => {
  assert.equal(computeStreak(['2026-08-19', '2026-08-18', '2026-08-17'], NOW), 3)
})

test('today not journaled yet — streak stays alive, counting from yesterday', () => {
  assert.equal(computeStreak(['2026-08-18', '2026-08-17', '2026-08-16'], NOW), 3)
})

test('a single entry yesterday keeps a live streak of 1', () => {
  assert.equal(computeStreak(['2026-08-18'], NOW), 1)
})

test('missing both today and yesterday breaks the streak', () => {
  assert.equal(computeStreak(['2026-08-17', '2026-08-16'], NOW), 0)
  assert.equal(computeStreak([], NOW), 0)
})

test('a gap in the middle stops the count at the gap', () => {
  assert.equal(computeStreak(['2026-08-19', '2026-08-18', '2026-08-15', '2026-08-14'], NOW), 2)
  assert.equal(computeStreak(['2026-08-19', '2026-08-16'], NOW), 1)
})

test('same-day duplicates count once; extra older runs are ignored', () => {
  assert.equal(computeStreak(['2026-08-19', '2026-08-19', '2026-08-18'], NOW), 2)
})

test('the streak is computed in the app timezone, not UTC', () => {
  // NOW (2026-08-18T20:00Z) is already Aug 19 in UTC+7. An entry stored at
  // 2026-08-18T18:00Z (= Aug 19 01:00 locally) belongs to the 19th, so the
  // streak with only that entry is 1 — a UTC-day reading would call it 0.
  assert.equal(computeStreak(['2026-08-19'], NOW), 1)
  // Conversely at 10:00Z the app-TZ "today" is still the 18th.
  assert.equal(computeStreak(['2026-08-18', '2026-08-17'], NOW_SAME_UTC_DAY), 2)
  assert.equal(computeStreak(['2026-08-19'], NOW_SAME_UTC_DAY), 0) // tomorrow's entry doesn't exist yet
})

test('crosses month boundaries correctly', () => {
  // Aug 19 → Aug 1 → Jul 31 (a 50-day run ending today).
  const days: string[] = []
  for (let i = 0; i < 50; i++) days.push(new Date(Date.UTC(2026, 7, 19) - i * 86400000).toISOString().slice(0, 10))
  assert.equal(computeStreak(days, NOW), 50)
})
